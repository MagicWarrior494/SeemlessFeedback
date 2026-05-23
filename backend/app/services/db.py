import sqlite3
import os

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
            transcript TEXT,
            summary TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

# Ensure the database tables are created when this module is loaded
init_db()