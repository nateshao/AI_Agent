from fastapi import FastAPI, Query, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import openai
import faiss
import numpy as np
from app.models import openai_model
from app.db import conversation as conv_db

app = FastAPI()

# 数据库初始化
DB_PATH = 'app/prompts.db'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Embedding 生成（以 OpenAI 为例）
def get_embedding(text: str) -> List[float]:
    # 这里假设你已设置 OPENAI_API_KEY 环境变量
    response = openai.Embedding.create(
        input=text,
        model="text-embedding-ada-002"
    )
    return response['data'][0]['embedding']

# Prompt Suggestion API
class SuggestRequest(BaseModel):
    query: str
    top_k: int = 3

class PromptSuggestion(BaseModel):
    prompt: str
    similarity: float

@app.post("/suggest", response_model=List[PromptSuggestion])
def suggest_prompts(req: SuggestRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, prompt, embedding FROM prompts")
    rows = cursor.fetchall()
    if not rows:
        return []
    # 取出所有 embedding
    prompt_texts = [row['prompt'] for row in rows]
    embeddings = [np.frombuffer(row['embedding'], dtype=np.float32) for row in rows]
    # 查询 embedding
    query_emb = np.array(get_embedding(req.query), dtype=np.float32)
    # faiss 相似度
    index = faiss.IndexFlatL2(len(query_emb))
    index.add(np.stack(embeddings))
    D, I = index.search(np.expand_dims(query_emb, 0), req.top_k)
    suggestions = []
    for idx, dist in zip(I[0], D[0]):
        suggestions.append(PromptSuggestion(prompt=prompt_texts[idx], similarity=float(-dist)))
    return suggestions

class StartConversationResponse(BaseModel):
    conversation_id: int

@app.post("/conversation/start", response_model=StartConversationResponse)
def start_conversation(title: Optional[str] = None):
    conversation_id = conv_db.create_conversation(title)
    return StartConversationResponse(conversation_id=conversation_id)

class Message(BaseModel):
    role: str
    content: str

@app.get("/conversation/{conversation_id}/messages", response_model=List[Message])
def get_conversation_messages(conversation_id: int):
    messages = conv_db.get_messages(conversation_id)
    return [Message(**m) for m in messages]

class CompletionRequest(BaseModel):
    prompt: str
    model: str = "openai"
    model_params: dict = {}
    conversation_id: Optional[int] = None

class CompletionResponse(BaseModel):
    response: str

@app.post("/completion", response_model=CompletionResponse)
def completion(req: CompletionRequest):
    messages = []
    if req.conversation_id:
        # 取历史消息
        messages = conv_db.get_messages(req.conversation_id)
        # 拼接用户新消息
        messages = messages + [{"role": "user", "content": req.prompt}]
    else:
        messages = [{"role": "user", "content": req.prompt}]
    if req.model == "openai":
        try:
            model_params = dict(req.model_params)
            model_params["messages"] = messages
            result = openai_model.generate_completion(req.prompt, model_params)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        # 自动存储消息
        if req.conversation_id:
            conv_db.add_message(req.conversation_id, "user", req.prompt)
            conv_db.add_message(req.conversation_id, "assistant", result)
        return CompletionResponse(response=result)
    elif req.model == "claude":
        raise HTTPException(status_code=501, detail="Claude 暂未实现")
    elif req.model == "local":
        raise HTTPException(status_code=501, detail="本地模型暂未实现")
    else:
        raise HTTPException(status_code=400, detail="不支持的模型类型") 