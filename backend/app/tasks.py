import time
from app.main import celery_app
from app.services.transcriber import transcribe_and_diarize_audio, generate_summary
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
        
        # Update the database row with the transcript and change status to "COMPLETED"
        cursor.execute(
            "UPDATE jobs SET status = ?, transcript = ? WHERE task_id = ?",
            ("COMPLETED", transcript_str, task_id)
        )
        conn.commit()
        print(f"✅ Transcription saved for {task_id}.")

        return {"status": "Transcription complete.", "task_id": task_id}

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


@celery_app.task(name="app.tasks.summarize_transcript")
def summarize_transcript(task_id: str):
    """
    Retrieves the transcript from the database, calls the summary service,
    and updates the database with the summary and completed status.
    """
    print(f"⏳ Starting summarization for Task ID: {task_id}")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Fetch the transcript
        cursor.execute("SELECT transcript FROM jobs WHERE task_id = ?", (task_id,))
        row = cursor.fetchone()
        if not row:
            print(f"❌ Summarization failed: Task ID {task_id} not found in database.")
            return
            
        transcript_str = row["transcript"]
        if not transcript_str:
            print(f"⚠️ Transcript is empty for Task ID {task_id}. Skipping summary.")
            cursor.execute(
                "UPDATE jobs SET status = ?, summary = ? WHERE task_id = ?",
                ("COMPLETED", "No transcript was generated.", task_id)
            )
            conn.commit()
            return

        # Generate summary using the transcriber service
        summary_text = generate_summary(transcript_str)
        
        # Save summary and update status to COMPLETED
        cursor.execute(
            "UPDATE jobs SET status = ?, summary = ? WHERE task_id = ?",
            ("COMPLETED", summary_text, task_id)
        )
        conn.commit()
        print(f"✅ Summarization completed successfully for Task ID: {task_id}")
        
    except Exception as e:
        # Update job status to SUMMARY_FAILED on failure
        cursor.execute(
            "UPDATE jobs SET status = ? WHERE task_id = ?",
            ("SUMMARY_FAILED", task_id)
        )
        conn.commit()
        print(f"❌ Summarization task {task_id} failed: {str(e)}")
        raise e
        
    finally:
        conn.close()

@celery_app.task(name="app.tasks.summarize_transcript")
def summarize_transcript(task_id: str):
    """
    Background Task Orchestration for Summarization:
    1. Updates job status to 'SUMMARIZING' in SQLite.
    2. Pulls the raw transcript string you saved.
    3. Executes the teammate's custom summarization code.
    4. Saves the summary string and marks status as 'SUCCESS'.
    """
    print(f"🤖 Summarization worker triggered for Task ID: {task_id}")
    
    # 1. Update database status to let the frontend know summarization started
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE jobs SET status = ? WHERE task_id = ?", 
        ("SUMMARIZING", task_id)
    )
    conn.commit()

    try:
        # 2. Fetch the transcript text that Alex's pipeline just generated
        cursor.execute("SELECT transcript FROM jobs WHERE task_id = ?", (task_id,))
        job = cursor.fetchone()
        
        if not job or not job["transcript"]:
            raise Exception(f"No transcript found in database for task {task_id}")
            
        # Parse the JSON string back into a readable format for the LLM prompt
        transcript_data = json.loads(job["transcript"])
        
        # Format the text list into a solid dialogue script string for an LLM
        formatted_script = "\n".join([f"{seg['speaker']}: {seg['text']}" for seg in transcript_data])

        # ==========================================
        # 3. TEAMMATE'S LLM PROCESSING SPACE
        # ==========================================
        # Your teammate will write their custom Gemini/LLM summary generation 
        # code here using the 'formatted_script' string variable above.
        
        generated_summary = "Placeholder summary: The meeting was transcribed and is awaiting a custom LLM summary generation script."
        
        # ==========================================

        # 4. Save the finished summary string to the database and close out the job ticket
        cursor.execute(
            "UPDATE jobs SET status = ?, summary = ? WHERE task_id = ?",
            ("SUCCESS", generated_summary, task_id)
        )
        conn.commit()
        print(f"🎉 Job {task_id} completely finished and saved!")
        return {"status": "SUCCESS", "task_id": task_id}

    except Exception as e:
        cursor.execute(
            "UPDATE jobs SET status = ? WHERE task_id = ?",
            ("SUMMARIZATION_FAILED", task_id)
        )
        conn.commit()
        print(f"❌ Summarization failed for task {task_id}: {str(e)}")
        raise e
        
    finally:
        conn.close()