import sqlite3
import os
import json

# Anchor the DB to a fixed absolute location (backend/seemlessfeedback.db) so the
# FastAPI server and the Celery worker always open the SAME file, no matter which
# directory each process is launched from. A relative path resolves against the
# process CWD, which silently split the app across two different database files.
DB_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "seemlessfeedback.db")
)

def get_db_connection():
    """Opens a connection to the SQLite database file with thread-safe multi-threading enabled."""
    conn = sqlite3.connect(
        DB_PATH, 
        timeout=30.0,                  
        check_same_thread=False   
    )
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Creates the database table if it doesn't exist yet."""
    conn = get_db_connection()
    cursor = conn.cursor()
        
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('student', 'instructor')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            task_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            file_path TEXT,
            speaker_count INTEGER DEFAULT 0,
            transcript TEXT,
            summary TEXT,
            user_id TEXT,  -- <-- foreign key link tracking WHO uploaded this clip
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(user_id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS courses (
            course_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL COLLATE NOCASE UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS teachers (
            teacher_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL COLLATE NOCASE UNIQUE,
            user_id TEXT, -- Links directly to users(user_id)
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(user_id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS teacher_courses (
            teacher_id INTEGER NOT NULL,
            course_id INTEGER NOT NULL,
            PRIMARY KEY (teacher_id, course_id),
            FOREIGN KEY(teacher_id) REFERENCES teachers(teacher_id),
            FOREIGN KEY(course_id) REFERENCES courses(course_id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS finalized_feedback (
            task_id TEXT PRIMARY KEY,
            course_id INTEGER NOT NULL,
            teacher_id INTEGER NOT NULL,
            summary TEXT NOT NULL,
            finalized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(task_id) REFERENCES jobs(task_id),
            FOREIGN KEY(course_id) REFERENCES courses(course_id),
            FOREIGN KEY(teacher_id) REFERENCES teachers(teacher_id)
        )
    ''')

    conn.commit()
    conn.close()

# Ensure the database tables are created when this module is loaded
init_db()

def fetch_job_by_id(task_id: str) -> dict | None:
    """
    Queries the database for a specific task ID. 
    Returns a cleaned dictionary if found, or None if it doesn't exist.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "SELECT status, transcript, summary FROM jobs WHERE task_id = ?", 
        (task_id,)
    )
    job = cursor.fetchone()
    conn.close()
    
    if not job:
        return None
        
    # Format the data cleanly into a Python dictionary
    result = {
        "task_id": task_id,
        "status": job["status"],
        "transcript": None,
        "summary": job["summary"]
    }
    
    # Safely unpack the serialized text array if it exists
    if job["transcript"]:
        result["transcript"] = json.loads(job["transcript"])
        
    return result

def _row_to_history_entry(row) -> dict:
    """Shapes a jobs row into the field names the History UI reads."""
    transcript = row["transcript"]
    if transcript:
        try:
            segments = json.loads(transcript)
            transcript = "\n".join(
                f"{seg['speaker']}: {seg['text']}" for seg in segments
            )
        except Exception:
            pass  # Older rows stored the transcript as plain text already.

    return {
        "id": row["task_id"],
        "createdAt": row["created_at"],
        "status": row["status"],
        "transcript": transcript,
        "summary": row["summary"],
        "courseName": row["course_name"],
    }

def fetch_jobs_for_instructor(user_id: str) -> list:
    """
    Queries history entries belonging to ONE instructor, newest first.

    A job is "theirs" once a student finalizes it against a teacher profile whose
    user_id matches this login. Jobs that are not finalized yet have no teacher
    association at all, so they belong to nobody and are correctly excluded.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        '''
        SELECT j.task_id, j.status, j.transcript, j.created_at,
               f.summary AS summary, c.name AS course_name
        FROM jobs j
        JOIN finalized_feedback f ON f.task_id = j.task_id
        JOIN teachers t ON t.teacher_id = f.teacher_id
        JOIN courses c ON c.course_id = f.course_id
        WHERE t.user_id = ?
        ORDER BY j.created_at DESC
        ''',
        (user_id,),
    )
    rows = cursor.fetchall()
    conn.close()

    return [_row_to_history_entry(row) for row in rows]

def fetch_all_jobs() -> list:
    """
    Queries the database for all history entries,
    sorted by newest first, so you can check recent transcripts.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT task_id, status, transcript, summary, created_at FROM jobs ORDER BY created_at DESC"
    )
    rows = cursor.fetchall()
    conn.close()

    jobs_list = []
    for row in rows:
        job = {
            "task_id": row["task_id"],
            "status": row["status"],
            "created_at": row["created_at"],
            "transcript": None,
            "summary": row["summary"]
        }
        # Safely parse the json string back to an array if it exists
        if row["transcript"]:
            try:
                job["transcript"] = json.loads(row["transcript"])
            except Exception:
                job["transcript"] = row["transcript"]
        jobs_list.append(job)
        
    return jobs_list
