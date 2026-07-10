import secrets
from app.services.db import get_db_connection

def create_course(name: str) -> bool:
    """Inserts a new course into the shared courses table."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO courses (name) VALUES (?)", (name,))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error creating course: {e}")
        return False
    finally:
        conn.close()

def get_courses_by_instructor(instructor_email: str) -> list:
    """
    Fetches only the courses that have submissions linked 
    to this specific instructor via the finalized_feedback table.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # We find the teacher by mapping their login email to the teachers table name
    cursor.execute('''
        SELECT DISTINCT c.course_id, c.name 
        FROM courses c
        JOIN finalized_feedback f ON c.course_id = f.course_id
        JOIN teachers t ON f.teacher_id = t.teacher_id
        WHERE t.name = ?
        ORDER BY c.name ASC
    ''', (instructor_email,))
    
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_all_courses() -> list:
    """Fetches every course for the global student dropdown."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT course_id, name FROM courses ORDER BY name ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]