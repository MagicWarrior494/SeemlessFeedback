from fastapi import FastAPI
import time
from fastapi.middleware.cors import CORSMiddleware
from celery import Celery
from app.api.routes import router
from app.services.db import fetch_job_by_id

import os
import shutil
from fastapi import FastAPI, HTTPException, UploadFile, File, Form

app = FastAPI(title="SeemlessFeedback API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

celery_app = Celery(
    "seemlessfeedback",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0",
    include=["app.tasks"]
)

app.include_router(router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

@app.get("/")
def read_root():
    return {"message": "FastAPI is running and Celery is configured!"}

#To add a new enpoint that triggers a background job, simply create a new function with @app.post("/endpoint_name") 
# then in the function import the task function from app.tasksand call .delay() 
# on it to enqueue the job. Feel free to return a message confirming the job was sent to the queue!
@app.post("/trigger")
def trigger_job(name: str):
    from app.tasks import test_background_job 
    test_background_job.delay(name)
    return {"message": "Job successfully sent to the Celery queue!"}


from app.services.db import fetch_all_jobs  # Add this to your imports at the top!

@app.get("/tasks/history")
def get_all_tasks_history() -> list:
    """
    Returns every transcription job saved in the SQLite database, 
    allowing you to review past transcripts without knowing their IDs.
    """
    return fetch_all_jobs()

# Ensure a physical directory exists locally on your machine to hold user clips
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "recordings"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/recordings")
async def save_recorded_audio(
    file: UploadFile = File(...), 
    duration_sec: str = Form(None)
) -> dict:
    """
    Receives incoming raw microphone data chunks from the frontend, 
    saves them to the disk, and instantly schedules the AI processing pipeline.
    """
    try:
        # 1. Create a unique, web-safe local filename using timestamp seeds
        clean_filename = f"live_recording_{int(time.time())}_{file.filename}"
        server_file_path = os.path.join(UPLOAD_DIR, clean_filename)
        
        # 2. Open a streaming disk handle and write the raw binary file chunks locally
        with open(server_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        print(f"💾 Fresh clip successfully saved to disk at: {server_file_path}")

        # 3. Calculate the relative path token your Celery workers need to read it
        # This converts the path back into the relative string layout: '../recordings/file.wav'
        relative_worker_path = os.path.join("..", "recordings", clean_filename).replace("\\", "/")

        # 4. Trigger your existing verification pipeline automatically!
        from app.tasks import process_audio_pipeline
        task = process_audio_pipeline.delay(relative_worker_path)

        return {
            "message": "Recording uploaded and AI pipeline initialized successfully.",
            "file_path": relative_worker_path,
            "task_id": task.id
        }

    except Exception as e:
        print(f"❌ Failed to save incoming audio data stream: {str(e)}")
        raise HTTPException(status_code=500, detail="Server failed to write audio payload to storage.")

@app.post("/process-audio")
def process_audio(file_path: str) -> dict:
    """
    Triggers the transcription pipeline.
    Returns the task_id immediately so the frontend can start polling.
    """
    from app.tasks import process_audio_pipeline
    
    # 1. Enqueue the task via Celery / Memurai
    task = process_audio_pipeline.delay(file_path)
    
    # 2. Hand back the tracking ticket ID to Kevin's frontend immediately
    return {
        "message": "Audio file accepted and queued for transcription.",
        "task_id": task.id
    }

@app.get("/tasks/status/{task_id}")
def get_task_status(task_id: str) -> dict:
    """
    API Router endpoint: Validates the request and passes the database
    result directly through to the frontend client.
    """
    # 1. Let the database service do the heavy logic lift
    job_data = fetch_job_by_id(task_id)
    
    # 2. Handle missing tickets instantly at the routing gate
    if not job_data:
        raise HTTPException(status_code=404, detail="Task ID not found in database.")
        
    # 3. Pass through the beautifully cleaned dictionary payload
    return job_data

