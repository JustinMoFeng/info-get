import sqlite3
import os

DB_PATH = "info_get.db"

def migrate_db():
    if not os.path.exists(DB_PATH):
        print("Database not found, nothing to migrate.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Checking if 'thought_steps' column exists in 'messages' table...")
        cursor.execute("PRAGMA table_info(messages)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if "thought_steps" not in columns:
            print("Adding 'thought_steps' column...")
            cursor.execute("ALTER TABLE messages ADD COLUMN thought_steps TEXT")
            conn.commit()
            print("Migration successful.")
        else:
            print("'thought_steps' column already exists.")
            
    except Exception as e:
        print(f"Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_db()
