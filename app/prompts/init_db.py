import sqlite3
import openai
import numpy as np
import os

DB_PATH = 'app/prompts.db'

PROMPTS = [
    "写一首关于春天的诗",
    "用 Python 实现快速排序",
    "介绍一下人工智能的发展史"
]

def get_embedding(text: str) -> list:
    response = openai.Embedding.create(
        input=text,
        model="text-embedding-ada-002"
    )
    return response['data'][0]['embedding']

def main():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt TEXT NOT NULL,
            embedding BLOB NOT NULL
        )
    ''')
    c.execute('''
        CREATE TABLE conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            created_at TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER,
            role TEXT,
            content TEXT,
            created_at TIMESTAMP,
            FOREIGN KEY(conversation_id) REFERENCES conversations(id)
        )
    ''')
    for prompt in PROMPTS:
        emb = np.array(get_embedding(prompt), dtype=np.float32)
        c.execute('INSERT INTO prompts (prompt, embedding) VALUES (?, ?)', (prompt, emb.tobytes()))
    conn.commit()
    conn.close()

if __name__ == "__main__":
    main() 