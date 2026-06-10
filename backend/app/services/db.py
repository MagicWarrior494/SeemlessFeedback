import sqlite3
import os
import json

DB_PATH = "seemlessfeedback.db"

def get_db_connection():
    """Opens a connection to the SQLite database file."""
    conn = sqlite3.connect(DB_PATH)
    # Allows us to access columns by name like row['status'] instead of just row[0]
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Creates the database table if it doesn't exist yet."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            task_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            file_path TEXT,
            transcript TEXT,
            summary TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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