from fastapi import FastAPI, Query, HTTPException, Request, Path, Body, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Any
import sqlite3
import openai
import faiss
import numpy as np
from app.models import openai_model
from app.db import conversation as conv_db
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import requests
from bs4 import BeautifulSoup
import json

app = FastAPI()

# 启用 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.api_route("/suggest", methods=["GET", "POST"], response_model=List[PromptSuggestion])
def suggest_prompts(req: Request):
    if req.method == "GET":
        query = req.query_params.get("query", "")
        top_k = int(req.query_params.get("top_k", 3))
    else:
        data = req.json() if hasattr(req, 'json') else {}
        data = req.json() if callable(data) else data
        data = data or {}
        query = data.get("query", "")
        top_k = data.get("top_k", 3)
    if not query:
        return []
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, prompt, embedding FROM prompts")
    rows = cursor.fetchall()
    if not rows:
        return []
    prompt_texts = [row['prompt'] for row in rows]
    embeddings = [np.frombuffer(row['embedding'], dtype=np.float32) for row in rows]
    query_emb = np.array(get_embedding(query), dtype=np.float32)
    index = faiss.IndexFlatL2(len(query_emb))
    index.add(np.stack(embeddings))
    D, I = index.search(np.expand_dims(query_emb, 0), top_k)
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

class ConversationInfo(BaseModel):
    id: int
    title: str = ""
    created_at: str = ""

@app.get("/conversation/list", response_model=List[ConversationInfo])
def list_conversations():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, created_at FROM conversations ORDER BY created_at DESC")
    rows = cursor.fetchall()
    return [ConversationInfo(id=row[0], title=row[1] or f"会话{row[0]}", created_at=str(row[2])) for row in rows]

@app.post("/conversation/{conversation_id}/rename")
def rename_conversation(conversation_id: int = Path(...), title: str = ""):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE conversations SET title = ? WHERE id = ?", (title, conversation_id))
    conn.commit()
    conn.close()
    return {"success": True}

@app.post("/conversation/{conversation_id}/delete")
def delete_conversation(conversation_id: int = Path(...)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
    cursor.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@app.post("/conversation/import")
def import_conversation(data: dict = Body(...)):
    title = data.get("title", "导入会话")
    messages = data.get("messages", [])
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('INSERT INTO conversations (title, created_at) VALUES (?, ?)', (title, "now"))
    conversation_id = cursor.lastrowid
    for msg in messages:
        cursor.execute('INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)',
                       (conversation_id, msg.get('role', 'user'), msg.get('content', ''), "now"))
    conn.commit()
    conn.close()
    return {"success": True, "conversation_id": conversation_id}

# 工具注册表
AGENT_TOOLS = {}

def search_web(query: str) -> str:
    """简单网页搜索工具，调用 DuckDuckGo API"""
    try:
        resp = requests.get(f'https://duckduckgo.com/html/?q={query}', timeout=5)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, 'html.parser')
            results = []
            for a in soup.select('.result__a')[:3]:
                results.append(a.get_text())
            return '\n'.join(results) if results else '未找到结果'
        return '搜索失败'
    except Exception as e:
        return f'搜索异常: {e}'

AGENT_TOOLS['search_web'] = {
    'desc': '网页搜索，输入关键词，返回搜索结果',
    'func': search_web
}

# 简单内存存储（可替换为数据库/持久化）
AGENT_MEMORY = {}

def get_agent_memory(user_id: str = 'default'):
    return AGENT_MEMORY.get(user_id, {})

def update_agent_memory(user_id: str, key: str, value):
    if user_id not in AGENT_MEMORY:
        AGENT_MEMORY[user_id] = {}
    AGENT_MEMORY[user_id][key] = value

AGENT_TYPES = {
    'general': {
        'name': '通用Agent',
        'desc': '全能型智能体，适合大多数任务',
        'system_prompt': '你是一个全能型智能体助手，善于理解和解决各种复杂问题。'
    },
    'market': {
        'name': '市场专家',
        'desc': '擅长市场分析、商业策略、行业调研',
        'system_prompt': '你是市场分析专家，擅长市场调研、商业分析、行业趋势判断。'
    },
    'tech': {
        'name': '技术专家',
        'desc': '擅长技术方案、架构设计、代码实现',
        'system_prompt': '你是技术专家，擅长技术方案设计、架构分析、代码实现。'
    },
    # 可扩展更多Agent
}

def agent_with_tools(goal: str, tools: list = None, memory: dict = None, user_id: str = 'default', agent_type: str = 'general', task_chain: list = None):
    """
    多Agent协作+任务链：支持用户自定义多步任务链，Agent自动串联执行。
    """
    memory = memory or get_agent_memory(user_id)
    base_prompt = AGENT_TYPES.get(agent_type, AGENT_TYPES['general'])['system_prompt']
    results = []
    all_steps = []
    all_tools = []
    if task_chain and isinstance(task_chain, list) and len(task_chain) > 0:
        for idx, sub_goal in enumerate(task_chain):
            system_prompt = (
                base_prompt +
                f"\n你当前的子任务：{sub_goal}\n"
                "你可以调用如下工具：\n"
                + '\n'.join([f"{k}: {v['desc']}" for k, v in AGENT_TOOLS.items()]) +
                "\n如需调用工具，请用如下格式：\n[TOOL] 工具名: 工具参数\n你必须在推理链中插入工具调用结果。"
                "你有如下记忆（可随时引用）：\n" + json.dumps(memory, ensure_ascii=False) +
                "\n如果信息不足，请主动向用户反问或提出建议。"
                "最终请输出本子任务的结果。"
            )
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": sub_goal}
            ]
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo-1106",
                messages=messages,
                temperature=0.7,
                max_tokens=1200
            )
            content = response['choices'][0]['message']['content']
            steps = []
            tool_calls = []
            for line in content.split('\n'):
                if line.strip().startswith('[TOOL]'):
                    try:
                        tool_line = line.strip()[7:].strip()
                        tool_name, tool_param = tool_line.split(':', 1)
                        tool_name = tool_name.strip()
                        tool_param = tool_param.strip()
                        if tool_name in AGENT_TOOLS:
                            tool_result = AGENT_TOOLS[tool_name]['func'](tool_param)
                            steps.append(f"[工具调用] {tool_name}({tool_param}) => {tool_result}")
                            tool_calls.append({"tool": tool_name, "param": tool_param, "result": tool_result})
                        else:
                            steps.append(f"[工具调用] 未知工具: {tool_name}")
                    except Exception as e:
                        steps.append(f"[工具调用] 解析失败: {e}")
                elif line.strip():
                    steps.append(line.strip())
            all_steps.append({"sub_goal": sub_goal, "steps": steps})
            all_tools.extend(tool_calls)
            # 记忆更新
            for step in steps:
                if step.startswith('记住') or '记住：' in step:
                    update_agent_memory(user_id, f"记忆_{len(memory)+1}", step)
            results.append(steps[-1] if steps else content)
        final_result = '\n'.join(results)
        return {
            "goal": goal,
            "task_chain": task_chain,
            "steps": all_steps,
            "tools": all_tools,
            "memory": get_agent_memory(user_id),
            "result": final_result,
            "agent_type": agent_type,
            "agent_name": AGENT_TYPES.get(agent_type, AGENT_TYPES['general'])['name']
        }
    # 无task_chain时，走原有单步逻辑
    # ...原有单步逻辑...
    # 复制原有 agent_with_tools 单步逻辑到此处
    base_prompt = AGENT_TYPES.get(agent_type, AGENT_TYPES['general'])['system_prompt']
    system_prompt = (
        base_prompt +
        "你可以调用如下工具：\n"
        + '\n'.join([f"{k}: {v['desc']}" for k, v in AGENT_TOOLS.items()]) +
        "\n如需调用工具，请用如下格式：\n[TOOL] 工具名: 工具参数\n你必须在推理链中插入工具调用结果。"
        "你有如下记忆（可随时引用）：\n" + json.dumps(memory, ensure_ascii=False) +
        "\n如果信息不足，请主动向用户反问或提出建议。"
        "最终请汇总所有子任务结果，输出最终答案。"
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": goal}
    ]
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo-1106",
        messages=messages,
        temperature=0.7,
        max_tokens=1200
    )
    content = response['choices'][0]['message']['content']
    steps = []
    tool_calls = []
    for line in content.split('\n'):
        if line.strip().startswith('[TOOL]'):
            try:
                tool_line = line.strip()[7:].strip()
                tool_name, tool_param = tool_line.split(':', 1)
                tool_name = tool_name.strip()
                tool_param = tool_param.strip()
                if tool_name in AGENT_TOOLS:
                    tool_result = AGENT_TOOLS[tool_name]['func'](tool_param)
                    steps.append(f"[工具调用] {tool_name}({tool_param}) => {tool_result}")
                    tool_calls.append({"tool": tool_name, "param": tool_param, "result": tool_result})
                else:
                    steps.append(f"[工具调用] 未知工具: {tool_name}")
            except Exception as e:
                steps.append(f"[工具调用] 解析失败: {e}")
        elif line.strip():
            steps.append(line.strip())
    for step in steps:
        if step.startswith('记住') or '记住：' in step:
            update_agent_memory(user_id, f"记忆_{len(memory)+1}", step)
    return {
        "goal": goal,
        "steps": steps,
        "tools": tool_calls,
        "memory": get_agent_memory(user_id),
        "result": steps[-1] if steps else content,
        "agent_type": agent_type,
        "agent_name": AGENT_TYPES.get(agent_type, AGENT_TYPES['general'])['name']
    }

@app.post("/agent")
def agent(goal: str = Body(...), tools: list = Body(default=[]), memory: dict = Body(default={}), user_id: str = Body(default='default'), agent_type: str = Body(default='general'), task_chain: list = Body(default=None)):
    """
    Agent模式：多Agent协作+任务链，支持自动化多步任务。
    """
    result = agent_with_tools(goal, tools, memory, user_id, agent_type, task_chain)
    return JSONResponse(content=result)

@app.get("/agent/types")
def get_agent_types():
    """
    获取所有可用Agent类型及描述
    """
    return [{"type": k, "name": v['name'], "desc": v['desc']} for k, v in AGENT_TYPES.items()] 