import time
import json
from app.main import celery_app
from app.services.transcriber import transcribe_and_diarize_audio
from app.services.summarizer import summarize_transcript as run_summarizer_engine
from app.services.db import get_db_connection

def _overload_backoff(retries: int) -> int:
    """Exponential backoff for transient Gemini 503/429 spikes: 5s, 10s, 20s... capped at 60s."""
    return min(5 * (2 ** retries), 60)


@celery_app.task(
    name="app.tasks.process_audio_pipeline",
    bind=True,                  # Required to access self.retry
    max_retries=6              # Retry up to 6 times with exponential backoff
)
def process_audio_pipeline(self, file_path: str, speaker_count: int = None):
    """
    Processes an audio file through the transcription pipeline.
    Saves the transcript array and stops, allowing humans to review 
    and edit the text before a summary is ever generated.
    """
    task_id = self.request.id
    print(f"⏳ Starting transcription pipeline for Task ID: {task_id} (Expected Speakers: {speaker_count})")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Use INSERT OR IGNORE so if it retries, it doesn't crash on a duplicate primary key error
    cursor.execute(
        "INSERT OR IGNORE INTO jobs (task_id, status, file_path, speaker_count) VALUES (?, ?, ?, ?)", 
        (task_id, "TRANSCRIBING", file_path, speaker_count)
    )
    # Ensure status is set back to transcribing on a retry attempt
    cursor.execute(
        "UPDATE jobs SET status = 'TRANSCRIBING' WHERE task_id = ?",
        (task_id,)
    )
    conn.commit()

    try:
        # 1. Fetch structured diarization transcript from Gemini
        transcript_list = transcribe_and_diarize_audio(file_path, speaker_count)
        transcript_str = json.dumps(transcript_list)
        
        # 2. Set status to TRANSCRIPT_READY and STOP here. Do not auto-trigger summarization!
        cursor.execute(
            "UPDATE jobs SET status = ?, transcript = ? WHERE task_id = ?",
            ("TRANSCRIPT_READY", transcript_str, task_id)
        )
        conn.commit()
        print(f"✅ Transcription saved for {task_id}. Standing by for human edits.")

        return {"status": "TRANSCRIPT_READY", "task_id": task_id}

    except Exception as e:
        print(f"⚠️ Transcription attempt failed for {task_id}: {str(e)}")
        
        # Check if Google is slammed with a 503 or 429 error code
        if "503" in str(e) or "UNAVAILABLE" in str(e) or "429" in str(e):
            countdown = _overload_backoff(self.request.retries)
            print(f"🔄 Gemini is experiencing high demand. Retrying transcription {task_id} in {countdown}s...")
            raise self.retry(exc=e, countdown=countdown)

        cursor.execute(
            "UPDATE jobs SET status = ? WHERE task_id = ?",
            ("TRANSCRIPTION_FAILED", task_id)
        )
        conn.commit()
        print(f"❌ Transcription task {task_id} completely failed: {str(e)}")
        raise e
    finally:
        conn.close()


@celery_app.task(
    name="app.tasks.summarize_transcript_task",
    bind=True,
    max_retries=6
)
def summarize_transcript_task(self, task_id: str):
    """
    Triggered on-demand when the user moves to the Summary tab.
    Pulls the LATEST edited transcript from the DB and builds the summary.
    """
    print(f"🤖 Summary worker task running for Task ID: {task_id}")
    try:
        run_summarizer_engine(task_id)
        print(f"🎉 Job {task_id} summary generated successfully from the latest transcript edits!")
        return {"status": "SUCCESS", "task_id": task_id}
    except Exception as e:
        print(f"⚠️ Summarization attempt failed for {task_id}: {str(e)}")
        if "503" in str(e) or "UNAVAILABLE" in str(e) or "429" in str(e):
            countdown = _overload_backoff(self.request.retries)
            print(f"🔄 Gemini overloaded. Retrying summary {task_id} in {countdown}s...")
            raise self.retry(exc=e, countdown=countdown)
        raise e