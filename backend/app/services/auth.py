import hashlib
import secrets
from app.services.db import get_db_connection

def hash_password(password: str) -> str:
    """Securely hashes a plaintext password using SHA-256."""
    return hashlib.sha256(password.encode()).hexdigest()

def create_user(email: str, password_raw: str, role: str) -> bool:
    """Inserts a new user account into the database if the email doesn't exist."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if user already exists
    cursor.execute("SELECT user_id FROM users WHERE email = ?", (email,))
    if cursor.fetchone():
        conn.close()
        return False
        
    user_id = secrets.token_hex(8) # Generates a clean unique ID string
    pwd_hash = hash_password(password_raw)
    
    try:
        cursor.execute(
            "INSERT INTO users (user_id, email, password_hash, role) VALUES (?, ?, ?, ?)",
            (user_id, email, pwd_hash, role)
        )
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()

def authenticate_user(email: str, password_raw: str) -> dict | None:
    """Validates user credentials against stored hashes."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    pwd_hash = hash_password(password_raw)
    cursor.execute(
        "SELECT user_id, email, role FROM users WHERE email = ? AND password_hash = ?",
        (email, pwd_hash)
    )
    user = cursor.fetchone()
    conn.close()
    
    if user:
        return {
            "user_id": user["user_id"],
            "email": user["email"],
            "role": user["role"]
        }
    return None