import time
from app.main import celery_app
from app.services.transcriber import transcribe_and_summarize_audio
from app.services.db import get_db_connection
import json

#to create a new task create a function and above it add @celery_app.task
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
    Updates the job status in the database at each step, saves the transcript, and triggers the summarization task.
    Saves the transcript to the database and triggers the summarization task.
    """

    # Add a new row to the database with the task_id and status "TRANSCRIBING"
    task_id = self.request.id
    print(f"⏳ Starting transcription pipeline for Task ID: {task_id}")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO jobs (task_id, status) VALUES (?, ?)", 
        (task_id, "TRANSCRIBING")
    )
    conn.commit()

    try:
        # Get the transcript and diarization data from Gemini
        transcript_list = transcribe_and_diarize_audio(file_path)
        transcript_str = json.dumps(transcript_list)
        
        # Update the database row with the transcript and change status to "NEEDS_SUMMARY"
        cursor.execute(
            "UPDATE jobs SET status = ?, transcript = ? WHERE task_id = ?",
            ("NEEDS_SUMMARY", transcript_str, task_id)
        )
        conn.commit()
        print(f"✅ Transcription saved for {task_id}. Handoff to summarizer...")

        # Add a new task to the Celery queue for summarization, passing the task_id 
        # so it can update the same database row when done
        celery_app.send_task(
            "app.tasks.summarize_transcript", 
            args=[task_id]
        )

        return {"status": "Transcription complete. Summarization queued.", "task_id": task_id}

    except Exception as e:
        # If any error occurs during transcription, update the job status to "TRANSCRIPTION_FAILED"
        cursor.execute(
            "UPDATE jobs SET status = ? WHERE task_id = ?",
            ("TRANSCRIPTION_FAILED", task_id)
        )
        conn.commit()
        print(f"❌ Transcription task {task_id} failed: {str(e)}")
        raise e
        
    finally:
        conn.close()