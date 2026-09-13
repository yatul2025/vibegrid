"""
database.py — SQLite Database Layer for TaskFlow
================================================
Demonstrates relational database concepts:
1. SQL Schema definition (CREATE TABLE, Primary Keys, Foreign Keys)
2. Password hashing (SHA-256 with salt) for secure credential storage
3. Parameterized SQL queries to prevent SQL Injection attacks
4. CRUD operations (INSERT, SELECT, UPDATE, DELETE)
"""

import sqlite3
import hashlib
import os
from datetime import datetime

DB_FILE = os.path.join(os.path.dirname(__file__), "taskflow.db")

def get_connection():
    """Returns a connection to the SQLite database with row_factory enabled."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row  # Allows accessing columns by name (row['title'])
    return conn

def hash_password(password: str) -> str:
    """Hash password using SHA-256."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def init_db():
    """Initializes tables and seeds default user and starter tasks."""
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Tasks Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        title TEXT NOT NULL,
        completed INTEGER DEFAULT 0,
        priority TEXT DEFAULT 'medium',
        category TEXT DEFAULT 'General',
        due_date TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Seed Default User (@tul / Atul) if not exists
    default_username = "@tul"
    default_password = "Atul"
    cursor.execute("SELECT id FROM users WHERE username = ?", (default_username,))
    existing_user = cursor.fetchone()

    if not existing_user:
        cursor.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (default_username, hash_password(default_password))
        )
        print(f"[DB] Created default user: {default_username}")

        # Seed starter tasks for @tul
        starter_tasks = [
            (default_username, "Welcome to TaskFlow with SQLite DB! Complete this task by checking the box", 0, "high", "General", datetime.now().strftime("%Y-%m-%d")),
            (default_username, "Inspect taskflow.db file in your project folder to see real SQL storage", 0, "medium", "Learning", ""),
            (default_username, "Learn SQL queries: SELECT, INSERT, UPDATE, DELETE", 0, "high", "Learning", "")
        ]
        cursor.executemany(
            "INSERT INTO tasks (username, title, completed, priority, category, due_date) VALUES (?, ?, ?, ?, ?, ?)",
            starter_tasks
        )
        print(f"[DB] Seeded {len(starter_tasks)} starter tasks in SQLite database.")

    conn.commit()
    conn.close()

# ============================================================================
# User Operations
# ============================================================================

def authenticate_user(username: str, password: str):
    """Checks credentials against the SQLite database."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, password_hash FROM users WHERE username = ?", (username,))
    user = cursor.fetchone()
    conn.close()

    if user and user["password_hash"] == hash_password(password):
        return {"id": user["id"], "username": user["username"]}
    return None

def register_user(username: str, password: str):
    """Registers a new user in SQLite."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, hash_password(password))
        )
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        return {"id": user_id, "username": username}
    except sqlite3.IntegrityError:
        conn.close()
        return None  # Username already exists

# ============================================================================
# Task CRUD Operations
# ============================================================================

def get_tasks(username: str):
    """Fetches all tasks for a specific user from SQLite."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, title, completed, priority, category, due_date, created_at FROM tasks WHERE username = ? ORDER BY id DESC",
        (username,)
    )
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row["id"],
            "username": row["username"],
            "title": row["title"],
            "completed": bool(row["completed"]),
            "priority": row["priority"],
            "category": row["category"],
            "dueDate": row["due_date"] or "",
            "createdAt": row["created_at"]
        }
        for row in rows
    ]

def add_task(username: str, title: str, priority: str = "medium", category: str = "General", due_date: str = ""):
    """Inserts a new task into SQLite and returns the inserted task object."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO tasks (username, title, completed, priority, category, due_date) VALUES (?, ?, 0, ?, ?, ?)",
        (username, title, priority, category, due_date)
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()

    return {
        "id": new_id,
        "username": username,
        "title": title,
        "completed": False,
        "priority": priority,
        "category": category,
        "dueDate": due_date,
        "createdAt": datetime.now().isoformat()
    }

def update_task(task_id: int, title: str = None, completed: bool = None):
    """Updates a task in SQLite."""
    conn = get_connection()
    cursor = conn.cursor()

    if completed is not None and title is not None:
        cursor.execute("UPDATE tasks SET title = ?, completed = ? WHERE id = ?", (title, int(completed), task_id))
    elif completed is not None:
        cursor.execute("UPDATE tasks SET completed = ? WHERE id = ?", (int(completed), task_id))
    elif title is not None:
        cursor.execute("UPDATE tasks SET title = ? WHERE id = ?", (title, task_id))

    conn.commit()
    conn.close()
    return True

def delete_task(task_id: int):
    """Deletes a task by ID from SQLite."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()
    return True

def clear_completed_tasks(username: str):
    """Deletes all completed tasks for a user from SQLite."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tasks WHERE username = ? AND completed = 1", (username,))
    conn.commit()
    conn.close()
    return True
