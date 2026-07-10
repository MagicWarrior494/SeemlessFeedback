import secrets
from app.services.db import get_db_connection

def create_course(course_name: str, instructor_id: str) -> bool:
    """Inserts a new course row linked to the creator instructor."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    course_id = secrets.token_hex(8) # Generates a clean, unique course ID
    
    try:
        cursor.execute(
            "INSERT INTO courses (course_id, course_name, instructor_id) VALUES (?, ?, ?)",
            (course_id, course_name, instructor_id)
        )
        conn.commit()
        return True
    except Exception as e:
        print(f"Error creating course: {e}")
        return False
    finally:
        conn.close()

def get_all_courses() -> list:
    """Fetches a master list of all courses alongside their instructor's email."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Using a JOIN to include the instructor's email so students know whose class it is
    cursor.execute('''
        SELECT c.course_id, c.course_name, u.email as instructor_email 
        FROM courses c
        JOIN users u ON c.instructor_id = u.user_id
        ORDER BY c.course_name ASC
    ''')
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]