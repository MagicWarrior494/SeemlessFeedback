from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from celery import Celery
from app.api.routes import router
from app.services.db import fetch_job_by_id

app = FastAPI(title="SeemlessFeedback API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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