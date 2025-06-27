import sqlite3
from typing import List, Dict
from datetime import datetime

DB_PATH = 'app/prompts.db'

def create_conversation(title: str = None) -> int:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('INSERT INTO conversations (title, created_at) VALUES (?, ?)', (title, datetime.now()))
    conversation_id = c.lastrowid
    conn.commit()
    conn.close()
    return conversation_id

def add_message(conversation_id: int, role: str, content: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)',
              (conversation_id, role, content, datetime.now()))
    conn.commit()
    conn.close()

def get_messages(conversation_id: int) -> List[Dict]:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', (conversation_id,))
    rows = c.fetchall()
    conn.close()
    return [{'role': row[0], 'content': row[1]} for row in rows] 