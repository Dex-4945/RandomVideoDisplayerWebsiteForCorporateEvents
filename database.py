import sqlite3
import os

def init_db():
    """Initialize the database and create tables"""
    try:
        conn = sqlite3.connect('file_system.db')
        cursor = conn.cursor()
        
        # Create files table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS root (
                ID INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                parentFolder TEXT DEFAULT "Root",
                toDisplay BOOLEAN DEFAULT 1,
                selected BOOLEAN DEFAULT 1,
                displayed BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                isFile BOOLEAN DEFAULT 1,
                isWanted BOOLEAN DEFAULT 0
            )
        ''')
        
        conn.commit()
        print("Database initialized successfully")
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
    except Exception as e:
        print(f"Exception in init_db: {e}")
    finally:
        if conn:
            conn.close()

def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect('file_system.db')
    conn.row_factory = sqlite3.Row  # This enables column access by name
    return conn