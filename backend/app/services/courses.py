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

def create_course_for_teacher(name: str, teacher_id: int) -> bool:
    """Inserts a new course and links it directly to the instructor."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # 1. Insert course
        cursor.execute("INSERT INTO courses (name) VALUES (?)", (name,))
        course_id = cursor.lastrowid
        
        # 2. Create link in junction table
        cursor.execute("INSERT INTO teacher_courses (teacher_id, course_id) VALUES (?, ?)", (teacher_id, course_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error creating course: {e}")
        return False
    finally:
        conn.close()

def create_and_link_instructor_course(user_id: str, course_name: str, teacher_name: str, link_account: bool) -> bool:
    """Creates a course and teacher profile, maps them together, and optionally links the user_id."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # 1. Get or create Teacher Profile by Name
        cursor.execute("SELECT teacher_id FROM teachers WHERE name = ? COLLATE NOCASE", (teacher_name,))
        teacher_row = cursor.fetchone()
        
        if teacher_row:
            teacher_id = teacher_row["teacher_id"]
            if link_account:
                # Update user_id on existing teacher profile
                cursor.execute("UPDATE teachers SET user_id = ? WHERE teacher_id = ?", (user_id, teacher_id))
        else:
            # Create new teacher profile
            t_user_id = user_id if link_account else None
            cursor.execute("INSERT INTO teachers (name, user_id) VALUES (?, ?)", (teacher_name, t_user_id))
            teacher_id = cursor.lastrowid

        # 2. Get or create Course
        cursor.execute("SELECT course_id FROM courses WHERE name = ? COLLATE NOCASE", (course_name,))
        course_row = cursor.fetchone()
        
        if course_row:
            course_id = course_row["course_id"]
        else:
            cursor.execute("INSERT INTO courses (name) VALUES (?)", (course_name,))
            course_id = cursor.lastrowid

        # 3. Link Course to Teacher in teacher_courses junction table
        cursor.execute(
            "INSERT OR IGNORE INTO teacher_courses (teacher_id, course_id) VALUES (?, ?)", 
            (teacher_id, course_id)
        )
        conn.commit()
        return True
    except Exception as e:
        print(f"Error linking course and teacher: {e}")
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