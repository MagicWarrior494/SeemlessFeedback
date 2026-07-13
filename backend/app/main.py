from fastapi import FastAPI
import time
from fastapi.middleware.cors import CORSMiddleware
from celery import Celery
from app.api.routes import router
from app.services.db import fetch_job_by_id

import os
import shutil
import json
import uuid
from fastapi import FastAPI, HTTPException, UploadFile, File, Form

from pydantic import BaseModel
from typing import List, Dict
from app.services.db import fetch_all_jobs, get_db_connection   

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header
from app.services.auth import create_user, authenticate_user
from app.services.courses import create_course, get_all_courses
from app.services.courses import create_and_link_instructor_course

app = FastAPI(title="SeemlessFeedback API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    duration_sec: str = Form(None),
    speaker_count: int = Form(None)  # Capture the frontend selection
) -> dict:
    """
    Receives incoming raw microphone data chunks from the frontend, 
    saves them to disk, and schedules the AI processing pipeline with user configs.
    """
    try:
        clean_filename = f"live_recording_{int(time.time())}_{file.filename}"
        server_file_path = os.path.join(UPLOAD_DIR, clean_filename)
        
        with open(server_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        print(f"💾 Fresh clip successfully saved to disk at: {server_file_path}")

        relative_worker_path = os.path.join("recordings", clean_filename).replace("\\", "/")

        # Forward the explicit speaker count to the background task worker queue
        from app.tasks import process_audio_pipeline
        task = process_audio_pipeline.delay(relative_worker_path, speaker_count)

        return {
            "message": "Recording uploaded and AI pipeline initialized successfully.",
            "file_path": relative_worker_path,
            "task_id": task.id
        }

    except Exception as e:
        print(f"❌ Failed to save incoming audio data stream: {str(e)}")
        raise HTTPException(status_code=500, detail="Server failed to write audio payload to storage.")


class TranscriptSegment(BaseModel):
    speaker: str
    text: str

from typing import List, Dict

@app.post("/tasks/edit/{task_id}")
def edit_task_transcript(task_id: str, updated_transcript: List[Dict]) -> dict:
    """
    Receives an edited array of transcript blocks from the frontend 
    (containing spelling corrections or modified speaker names) and updates the DB.
    """
    from app.services.db import get_db_connection
    import json
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT status FROM jobs WHERE task_id = ?", (task_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Task ID not found.")
        
    try:
        # Accept the raw Python dictionary list directly and serialize it to the DB string column
        serialized_transcript = json.dumps(updated_transcript)
        
        cursor.execute(
            "UPDATE jobs SET transcript = ? WHERE task_id = ?",
            (serialized_transcript, task_id)
        )
        conn.commit()
        print(f"📝 Human transcript edits saved successfully for Task ID: {task_id}")
        return {"status": "SUCCESS", "message": "Transcript updated successfully."}
    except Exception as e:
        print(f"❌ Failed saving transcript edits for {task_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to write edits to database.")
    finally:
        conn.close()
        
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
def get_task_status(task_id: str):
    try:
        from app.services.db import fetch_job_by_id
        job = fetch_job_by_id(task_id)
        
        if not job:
            raise HTTPException(status_code=404, detail="Job entry not found in database.")
            
        # Ensure transcript is never returned as None/Null to keep React from crashing
        if job.get("transcript") is None:
            job["transcript"] = []
            
        return job
        
    except Exception as e:
        print(f"❌ CRASH inside status endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tasks/summarize/{task_id}")
def trigger_on_demand_summary(task_id: str) -> dict:
    """
    Called manually by the frontend when moving to the Summary tab.
    Kicks off the summarizer task using whatever transcript text currently exists in the DB.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT transcript FROM jobs WHERE task_id = ?", (task_id,))
    row = cursor.fetchone()
    
    if not row or not row["transcript"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Cannot summarize an empty or non-existent transcript.")
    
    cursor.execute("UPDATE jobs SET status = 'SUMMARIZING' WHERE task_id = ?", (task_id,))
    conn.commit()
    conn.close()
    
    celery_app.send_task("app.tasks.summarize_transcript_task", args=[task_id])
    
    return {"message": "Summarization pipeline initialized.", "task_id": task_id}


class RegisterRequest(BaseModel):
    email: str
    password: str
    role: str

class LoginRequest(BaseModel):
    email: str
    password: str


class NamedItemRequest(BaseModel):
    name: str


class FinalizeFeedbackRequest(BaseModel):
    course_id: int
    teacher_id: int
    summary: str


class TextFeedbackRequest(BaseModel):
    transcript: str


def list_named_items(table: str, id_column: str) -> list:
    conn = get_db_connection()
    rows = conn.execute(
        f"SELECT {id_column} AS id, name FROM {table} ORDER BY name COLLATE NOCASE"
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def create_named_item(table: str, id_column: str, name: str) -> dict:
    cleaned_name = name.strip()
    if not cleaned_name:
        raise HTTPException(status_code=400, detail="Name cannot be empty.")

    conn = get_db_connection()
    try:
        cursor = conn.execute(
            f"INSERT OR IGNORE INTO {table} (name) VALUES (?)",
            (cleaned_name,),
        )
        conn.commit()
        row = conn.execute(
            f"SELECT {id_column} AS id, name FROM {table} WHERE name = ? COLLATE NOCASE",
            (cleaned_name,),
        ).fetchone()
        return dict(row)
    finally:
        conn.close()


class CourseCreateRequest(BaseModel):
    name: str

@app.post("/api/courses")
def add_new_course(payload: CourseCreateRequest, x_user_role: str = Header(None)):
    """Allows instructors to add a new course."""
    if x_user_role != "instructor":
        raise HTTPException(
            status_code=403, 
            detail="Access Denied: Only instructors can create new courses."
        )
        
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Course name cannot be empty.")
        
    success = create_course(payload.name.strip())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save course to database.")
        
    return {"status": "SUCCESS", "message": "Course created successfully!"}

@app.get("/api/courses")
def fetch_courses(x_user_role: str = Header(None), x_user_email: str = Header(None)):
    """Returns filtered courses for instructors, or all courses for students."""
    if x_user_role == "instructor" and x_user_email:
        from app.services.courses import get_courses_by_instructor
        return get_courses_by_instructor(x_user_email)
    
    return get_all_courses()

@app.get("/api/teachers/{teacher_id}/courses")
def fetch_courses_for_teacher(teacher_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Query junction table mapping
    cursor.execute('''
        SELECT c.course_id, c.name 
        FROM courses c
        JOIN teacher_courses tc ON c.course_id = tc.course_id
        WHERE tc.teacher_id = ?
        ORDER BY c.name ASC
    ''', (teacher_id,))
    
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

class CourseLinkRequest(BaseModel):
    course_name: str
    teacher_name: str
    link_account: bool = False

@app.post("/api/courses/manage")
def setup_instructor_course(
    payload: CourseLinkRequest, 
    x_user_id: str = Header(None), 
    x_user_role: str = Header(None)
):
    user_id = x_user_id or "default_instructor_id"
    
    if not payload.course_name.strip() or not payload.teacher_name.strip():
        raise HTTPException(status_code=400, detail="Both Course Name and Instructor Name are required.")
        
    success = create_and_link_instructor_course(
        user_id=user_id,
        course_name=payload.course_name.strip(),
        teacher_name=payload.teacher_name.strip(),
        link_account=payload.link_account
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create and link course assignment.")
        
    return {"status": "SUCCESS", "message": "Course and Teacher assignment successfully saved!"}

@app.get("/api/teachers")
def get_teachers() -> list:
    return list_named_items("teachers", "teacher_id")


@app.post("/api/teachers", status_code=201)
def add_teacher(payload: NamedItemRequest) -> dict:
    return create_named_item("teachers", "teacher_id", payload.name)


@app.post("/tasks/text", status_code=201)
def create_text_feedback_task(payload: TextFeedbackRequest) -> dict:
    transcript = payload.transcript.strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcript cannot be empty.")

    task_id = f"text-{uuid.uuid4()}"
    transcript_rows = [
        {"speaker": "Transcript", "text": line.strip()}
        for line in transcript.splitlines()
        if line.strip()
    ]

    conn = get_db_connection()
    try:
        conn.execute(
            """
            INSERT INTO jobs (task_id, status, file_path, speaker_count, transcript)
            VALUES (?, ?, ?, ?, ?)
            """,
            (task_id, "TRANSCRIPT_READY", "text-upload", 0, json.dumps(transcript_rows)),
        )
        conn.commit()
    finally:
        conn.close()

    return {"status": "SUCCESS", "task_id": task_id}


@app.post("/tasks/finalize/{task_id}")
def finalize_task_feedback(task_id: str, payload: FinalizeFeedbackRequest) -> dict:
    summary = payload.summary.strip()
    if not summary:
        raise HTTPException(status_code=400, detail="Summary cannot be empty.")

    conn = get_db_connection()
    try:
        job = conn.execute("SELECT task_id FROM jobs WHERE task_id = ?", (task_id,)).fetchone()
        course = conn.execute(
            "SELECT course_id FROM courses WHERE course_id = ?", (payload.course_id,)
        ).fetchone()
        teacher = conn.execute(
            "SELECT teacher_id FROM teachers WHERE teacher_id = ?", (payload.teacher_id,)
        ).fetchone()
        if not job:
            raise HTTPException(status_code=404, detail="Task ID not found.")
        if not course or not teacher:
            raise HTTPException(status_code=400, detail="Select a valid course and teacher.")

        conn.execute(
            '''
            INSERT INTO finalized_feedback (task_id, course_id, teacher_id, summary)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(task_id) DO UPDATE SET
                course_id = excluded.course_id,
                teacher_id = excluded.teacher_id,
                summary = excluded.summary,
                finalized_at = CURRENT_TIMESTAMP
            ''',
            (task_id, payload.course_id, payload.teacher_id, summary),
        )
        conn.commit()
        return {"status": "SUCCESS", "message": "Feedback finalized."}
    finally:
        conn.close()


@app.post("/api/register")
def register_account(payload: RegisterRequest):
    """Saves a new user account down to your SQLite architecture."""
    if payload.role not in ["student", "instructor"]:
        raise HTTPException(status_code=400, detail="Invalid account tier role.")
        
    success = create_user(payload.email, payload.password, payload.role)
    if not success:
        raise HTTPException(status_code=400, detail="An account with that email already exists.")
        
    return {"status": "SUCCESS", "message": "User registered successfully!"}


@app.post("/api/login")
def login_account(payload: LoginRequest):
    """Verifies credentials and returns workspace configuration metadata keys."""
    user_profile = authenticate_user(payload.email, payload.password)
    if not user_profile:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
        
    return {
        "status": "SUCCESS",
        "user": user_profile
    }


@app.get("/tasks/history")
def get_all_tasks_history(x_user_role: str = Header(None)) -> list:  # <-- Tracks incoming header role
    """
    Returns history entries ONLY if the requesting account holds Instructor clearance.
    """
    # Force multi-tenant security verification right at the router threshold gate
    if x_user_role != "instructor":
        raise HTTPException(
            status_code=403, 
            detail="Access Denied: Students do not have clearance to evaluate master history logs."
        )
        
    from app.services.db import fetch_all_jobs
    return fetch_all_jobs()
