import time
import json
from app.main import celery_app
from app.services.transcriber import transcribe_and_diarize_audio
from app.services.summarizer import summarize_transcript as run_summarizer_engine
from app.services.db import get_db_connection

@celery_app.task
def test_background_job(name: str):
    print(f"⏳ Starting heavy work for {name}...")
    time.sleep(5)
    print(f"✅ Finished work for {name}!")
    return f"Hello {name}, your transcript is ready!"

@celery_app.task(name="app.tasks.process_audio_pipeline", bind=True)
def process_audio_pipeline(self, file_path: str):
    """
    Processes an audio file through the transcription pipeline.
    Saves the transcript array, updates status to 'SUMMARIZING', 
    and passes the task baton off to the background summarizer.
    """
    task_id = self.request.id
    print(f"⏳ Starting transcription pipeline for Task ID: {task_id}")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO jobs (task_id, status, file_path) VALUES (?, ?, ?)", 
        (task_id, "TRANSCRIBING", file_path)
    )
    conn.commit()

    try:
        # 1. Fetch structured diarization transcript from Gemini
        transcript_list = transcribe_and_diarize_audio(file_path)
        transcript_str = json.dumps(transcript_list)
        
        # 2. Update status showing transcription finished and ready for summary phase
        cursor.execute(
            "UPDATE jobs SET status = ?, transcript = ? WHERE task_id = ?",
            ("SUMMARIZING", transcript_str, task_id)
        )
        conn.commit()
        print(f"✅ Transcription saved for {task_id}. Dispatching task to summary worker...")

        # 3. TRIGGER THE SUMMARIZATION TASK AUTOMATICALLY VIA MEMURAI
        celery_app.send_task("app.tasks.summarize_transcript_task", args=[task_id])

        return {"status": "Transcription complete. Summarization queued.", "task_id": task_id}

    except Exception as e:
        cursor.execute(
            "UPDATE jobs SET status = ? WHERE task_id = ?",
            ("TRANSCRIPTION_FAILED", task_id)
        )
        conn.commit()
        print(f"❌ Transcription task {task_id} failed: {str(e)}")
        raise e
        
    finally:
        conn.close()


@celery_app.task(
    name="app.tasks.summarize_transcript_task", 
    bind=True,
    max_retries=3,               # Automatically retry up to 3 times if Google fails
    default_retry_delay=5        # Wait 5 seconds before trying again to let demand cool down
)
def summarize_transcript_task(self, task_id: str):
    """
    Background worker task that orchestrates your teammate's new 
    Gemini feedback summarizer script safely within Celery.
    Automatically handles 503 rate limits / high demand surges gracefully.
    """
    print(f"🤖 Summary worker task running for Task ID: {task_id}")
    try:
        run_summarizer_engine(task_id)
        print(f"🎉 Job {task_id} summary generated and database entry completed successfully!")
        return {"status": "SUCCESS", "task_id": task_id}
    except Exception as e:
        print(f"⚠️ Summarization attempt failed for {task_id}: {str(e)}")
        
        # Check if the error looks like an API capacity limitation issue (like 503 or 429)
        if "503" in str(e) or "UNAVAILABLE" in str(e):
            print(f"🔄 Google is busy. Retrying task {task_id} in 5 seconds...")
            raise self.retry(exc=e)
            
        print(f"❌ Permanent summarization failure for {task_id}: {str(e)}")
        raise e