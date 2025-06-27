import React, { useState, useEffect, useRef } from 'react';
import './App.css';

interface Message {
  role: string;
  content: string;
}

interface PromptSuggestion {
  prompt: string;
  similarity: number;
}

interface Conversation {
  id: number;
  title?: string;
}

const API_BASE = '';

const DEFAULT_MODEL_PARAMS = {
  temperature: 1,
  max_tokens: 1024,
  top_p: 1,
  presence_penalty: 0,
  frequency_penalty: 0,
};

const THEME_KEY = 'ai_agent_theme';
const API_KEY_KEY = 'ai_agent_api_key';

function App() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState('openai');
  const [modelParams, setModelParams] = useState(DEFAULT_MODEL_PARAMS);
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [selectedSuggest, setSelectedSuggest] = useState<number>(-1);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [editingConvId, setEditingConvId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [selectedConvs, setSelectedConvs] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [apiKey, setApiKey] = useState(localStorage.getItem(API_KEY_KEY) || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem(THEME_KEY) || 'light');
  const [showExportType, setShowExportType] = useState<number | null>(null);
  const suggestRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [agentMode, setAgentMode] = useState(false);
  const [agentGoal, setAgentGoal] = useState('');
  const [agentResult, setAgentResult] = useState<any>(null);
  const [agentLoading, setAgentLoading] = useState(false);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    fetch(`${API_BASE}/conversation/list`)
      .then(res => res.json())
      .then(setConversations);
  }, [conversationId]);

  useEffect(() => {
    if (conversationId) {
      fetch(`${API_BASE}/conversation/${conversationId}/messages`)
        .then(res => res.json())
        .then(setMessages);
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  useEffect(() => {
    if (prompt.trim()) {
      fetch(`${API_BASE}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: prompt, top_k: 5 })
      })
        .then(res => res.json())
        .then((data) => {
          setSuggestions(data);
          setShowSuggest(true);
          setSelectedSuggest(-1);
        });
    } else {
      setSuggestions([]);
      setShowSuggest(false);
      setSelectedSuggest(-1);
    }
  }, [prompt]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(event.target as Node)) {
        setShowSuggest(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const startConversation = async () => {
    const res = await fetch(`${API_BASE}/conversation/start`, { method: 'POST' });
    const data = await res.json();
    setConversationId(data.conversation_id);
    setResponse('');
    setMessages([]);
    fetch(`${API_BASE}/conversation/list`).then(res => res.json()).then(setConversations);
  };

  const handleSend = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setShowSuggest(false);
    const res = await fetch(`${API_BASE}/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model,
        model_params: modelParams,
        conversation_id: conversationId,
      }),
    });
    const data = await res.json();
    setResponse(data.response);
    setPrompt('');
    if (conversationId) {
      fetch(`${API_BASE}/conversation/${conversationId}/messages`)
        .then(res => res.json())
        .then(setMessages);
    }
    setLoading(false);
  };

  const handleSuggestionClick = (s: PromptSuggestion) => {
    setPrompt(s.prompt);
    setShowSuggest(false);
    textareaRef.current?.focus();
  };

  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggest || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggest((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggest((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && selectedSuggest >= 0) {
      e.preventDefault();
      setPrompt(suggestions[selectedSuggest].prompt);
      setShowSuggest(false);
    } else if (e.key === 'Escape') {
      setShowSuggest(false);
    }
  };

  const handleSelectConversation = (id: number) => {
    setConversationId(id);
    setResponse('');
  };

  const handleParamChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setModelParams((prev) => ({ ...prev, [name]: Number(value) }));
  };

  const handleRenameConversation = (id: number, title: string) => {
    setEditingConvId(id);
    setEditingTitle(title);
  };
  const handleRenameSubmit = async (id: number) => {
    await fetch(`${API_BASE}/conversation/${id}/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editingTitle })
    });
    setEditingConvId(null);
    setEditingTitle('');
    fetch(`${API_BASE}/conversation/list`).then(res => res.json()).then(setConversations);
  };
  const handleDeleteConversation = async (id: number) => {
    await fetch(`${API_BASE}/conversation/${id}/delete`, { method: 'POST' });
    if (conversationId === id) setConversationId(null);
    fetch(`${API_BASE}/conversation/list`).then(res => res.json()).then(setConversations);
  };

  const handleExportConversation = async (id: number) => {
    const res = await fetch(`${API_BASE}/conversation/${id}/messages`);
    const data = await res.json();
    const conv = conversations.find(c => c.id === id);
    const blob = new Blob([
      JSON.stringify({
        id,
        title: conv?.title || `会话${id}`,
        messages: data
      }, null, 2)
    ], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conv?.title || `会话${id}`}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectConv = (id: number, checked: boolean) => {
    setSelectedConvs(prev => checked ? [...prev, id] : prev.filter(cid => cid !== id));
  };
  const handleSelectAll = (checked: boolean) => {
    setSelectedConvs(checked ? conversations.map(c => c.id) : []);
  };
  const handleBatchDelete = async () => {
    for (const id of selectedConvs) {
      await fetch(`${API_BASE}/conversation/${id}/delete`, { method: 'POST' });
    }
    setSelectedConvs([]);
    fetch(`${API_BASE}/conversation/list`).then(res => res.json()).then(setConversations);
    if (selectedConvs.includes(conversationId!)) setConversationId(null);
  };

  const filteredMessages = search.trim()
    ? messages.filter(m => m.content.toLowerCase().includes(search.toLowerCase()))
    : messages;

  const highlight = (text: string) => {
    if (!search.trim()) return text;
    const parts = text.split(new RegExp(`(${search})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === search.toLowerCase() ? <mark key={i}>{part}</mark> : part
    );
  };

  const handleSaveApiKey = () => {
    localStorage.setItem(API_KEY_KEY, apiKey);
    setShowApiKey(false);
  };

  const handleImportClick = () => fileInputRef.current?.click();
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      await fetch(`${API_BASE}/conversation/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      fetch(`${API_BASE}/conversation/list`).then(res => res.json()).then(setConversations);
    } catch {
      alert('导入失败，文件格式错误');
    }
  };

  const handleExportMarkdown = async (id: number) => {
    const res = await fetch(`${API_BASE}/conversation/${id}/messages`);
    const data = await res.json();
    const conv = conversations.find(c => c.id === id);
    let md = `# ${conv?.title || `会话${id}`}`;
    data.forEach((msg: Message) => {
      md += `\n\n**${msg.role === 'user' ? '🧑 用户' : '🤖 AI'}：**\n\n${msg.content}`;
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conv?.title || `会话${id}`}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportType(null);
  };

  const handleAgentRun = async () => {
    setAgentLoading(true);
    setAgentResult(null);
    const res = await fetch(`${API_BASE}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: agentGoal })
    });
    const data = await res.json();
    setAgentResult(data);
    setAgentLoading(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ width: 270, background: 'var(--sidebar-bg)', borderRight: '1px solid #eee', padding: 16 }}>
        <div style={{ marginBottom: 12, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>历史会话</span>
          <input type="checkbox" checked={selectedConvs.length === conversations.length && conversations.length > 0} onChange={e => handleSelectAll(e.target.checked)} />
        </div>
        <button onClick={startConversation} disabled={loading} style={{ width: '100%', marginBottom: 8 }}>
          新建会话
        </button>
        <button onClick={handleImportClick} style={{ width: '100%', marginBottom: 8, background: '#52c41a' }}>
          导入会话
        </button>
        <input type="file" accept="application/json" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImportFile} />
        <button onClick={handleBatchDelete} disabled={selectedConvs.length === 0} style={{ width: '100%', marginBottom: 12, background: '#e74c3c' }}>
          批量删除
        </button>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {conversations.map((c) => (
            <div
              key={c.id}
              style={{
                padding: '8px 6px',
                background: c.id === conversationId ? 'var(--selected)' : 'transparent',
                borderRadius: 6,
                cursor: 'pointer',
                marginBottom: 4,
                fontWeight: c.id === conversationId ? 'bold' : 'normal',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'background 0.2s',
              }}
            >
              <input type="checkbox" checked={selectedConvs.includes(c.id)} onChange={e => handleSelectConv(c.id, e.target.checked)} style={{ marginRight: 4 }} />
              <span onClick={() => handleSelectConversation(c.id)} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {editingConvId === c.id ? (
                  <input
                    value={editingTitle}
                    onChange={e => setEditingTitle(e.target.value)}
                    onBlur={() => handleRenameSubmit(c.id)}
                    onKeyDown={e => e.key === 'Enter' && handleRenameSubmit(c.id)}
                    autoFocus
                    style={{ width: '80%' }}
                  />
                ) : (
                  c.title || `会话 ${c.id}`
                )}
              </span>
              <span style={{ marginLeft: 4, display: 'flex', alignItems: 'center', position: 'relative' }}>
                <button style={{ background: 'none', color: '#888', border: 'none', cursor: 'pointer', fontSize: 14, padding: 0, marginRight: 2 }} onClick={() => handleRenameConversation(c.id, c.title || `会话 ${c.id}`)}>✏️</button>
                <button style={{ background: 'none', color: '#e74c3c', border: 'none', cursor: 'pointer', fontSize: 14, padding: 0, marginLeft: 2, marginRight: 2 }} onClick={() => handleDeleteConversation(c.id)}>🗑️</button>
                <button style={{ background: 'none', color: '#1890ff', border: 'none', cursor: 'pointer', fontSize: 14, padding: 0, marginLeft: 2 }} onClick={() => setShowExportType(showExportType === c.id ? null : c.id)}>⬇️</button>
                {showExportType === c.id && (
                  <div style={{ position: 'absolute', top: 24, right: 0, background: '#fff', border: '1px solid #eee', borderRadius: 4, zIndex: 20 }}>
                    <div style={{ padding: '6px 16px', cursor: 'pointer' }} onClick={() => { handleExportConversation(c.id); setShowExportType(null); }}>导出 JSON</div>
                    <div style={{ padding: '6px 16px', cursor: 'pointer' }} onClick={() => handleExportMarkdown(c.id)}>导出 Markdown</div>
                  </div>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'fixed', top: 18, right: 32, zIndex: 100 }}>
        <button onClick={() => setShowApiKey(true)} style={{ marginRight: 12 }}>API Key</button>
        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? '🌙 暗' : '☀️ 亮'}</button>
      </div>
      {showApiKey && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.2)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 32, borderRadius: 12, minWidth: 320 }}>
            <h3>OpenAI API Key 设置</h3>
            <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)} style={{ width: '100%', marginBottom: 16 }} />
            <div style={{ textAlign: 'right' }}>
              <button onClick={handleSaveApiKey} style={{ marginRight: 8 }}>保存</button>
              <button onClick={() => setShowApiKey(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
      <div className="App" style={{ flex: 1, maxWidth: 700, margin: '0 auto', padding: 24 }}>
        <h2>AI Prompt Agent 控制台</h2>
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setAgentMode(!agentMode)} style={{ marginRight: 12 }}>
            {agentMode ? '返回普通模式' : 'Agent模式'}
          </button>
        </div>
        {agentMode ? (
          <div style={{ background: 'var(--msg-bg)', borderRadius: 8, padding: 24 }}>
            <h3>Agent模式：任务分解与多步推理</h3>
            <textarea
              value={agentGoal}
              onChange={e => setAgentGoal(e.target.value)}
              rows={3}
              style={{ width: '100%', marginBottom: 12, borderRadius: 8, border: '1.5px solid #b3d8fd', fontSize: 16, padding: 10 }}
              placeholder="请输入你的复杂目标，如：帮我写一份AI创业计划书"
              disabled={agentLoading}
            />
            <div>
              <button onClick={handleAgentRun} disabled={agentLoading || !agentGoal.trim()} style={{ padding: '8px 24px', fontSize: 16 }}>
                运行Agent
              </button>
            </div>
            {agentLoading && <div style={{ marginTop: 16 }}>Agent 正在思考...</div>}
            {agentResult && (
              <div style={{ marginTop: 24 }}>
                <h4>目标：</h4>
                <div>{agentResult.goal}</div>
                <h4 style={{ marginTop: 16 }}>推理链路：</h4>
                <ol>
                  {agentResult.steps && agentResult.steps.map((step: string, idx: number) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
                <h4 style={{ marginTop: 16 }}>最终结果：</h4>
                <div>{agentResult.result}</div>
              </div>
            )}
          </div>
        ) : (
          <>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索消息..."
              style={{ width: 220, marginRight: 16, borderRadius: 6, border: '1px solid #eee', padding: 6 }}
            />
            <select value={model} onChange={e => setModel(e.target.value)} style={{ marginRight: 12 }}>
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
              <option value="local">本地模型</option>
            </select>
            <span style={{ marginRight: 8 }}>temperature:</span>
            <input
              type="number"
              name="temperature"
              min={0}
              max={2}
              step={0.1}
              value={modelParams.temperature}
              onChange={handleParamChange}
              style={{ width: 60, marginRight: 12 }}
            />
            <span style={{ marginRight: 8 }}>max_tokens:</span>
            <input
              type="number"
              name="max_tokens"
              min={1}
              max={4096}
              step={1}
              value={modelParams.max_tokens}
              onChange={handleParamChange}
              style={{ width: 70, marginRight: 12 }}
            />
            <span style={{ marginRight: 8 }}>top_p:</span>
            <input
              type="number"
              name="top_p"
              min={0}
              max={1}
              step={0.01}
              value={modelParams.top_p}
              onChange={handleParamChange}
              style={{ width: 60, marginRight: 12 }}
            />
            <span style={{ marginRight: 8 }}>presence_penalty:</span>
            <input
              type="number"
              name="presence_penalty"
              min={-2}
              max={2}
              step={0.01}
              value={modelParams.presence_penalty}
              onChange={handleParamChange}
              style={{ width: 60, marginRight: 12 }}
            />
            <span style={{ marginRight: 8 }}>frequency_penalty:</span>
            <input
              type="number"
              name="frequency_penalty"
              min={-2}
              max={2}
              step={0.01}
              value={modelParams.frequency_penalty}
              onChange={handleParamChange}
              style={{ width: 60 }}
            />
          </div>
          <div style={{ minHeight: 200, background: 'var(--msg-bg)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
            {filteredMessages.map((msg, idx) => (
              <div key={idx} style={{ textAlign: msg.role === 'user' ? 'right' : 'left', margin: '8px 0' }}>
                <b>{msg.role === 'user' ? '🧑' : '🤖'}：</b> <span>{highlight(msg.content)}</span>
              </div>
            ))}
            {loading && <div>AI 正在思考...</div>}
          </div>
          <div style={{ position: 'relative' }} ref={suggestRef}>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handlePromptKeyDown}
              rows={3}
              style={{ width: '100%', marginBottom: 8, borderRadius: 8, border: '1.5px solid #b3d8fd', fontSize: 16, padding: 10, background: 'var(--input-bg)', color: 'var(--input-color)' }}
              placeholder="请输入你的问题..."
              disabled={loading}
              onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
            />
            {showSuggest && suggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '100%',
                background: 'var(--suggest-bg)',
                border: '1px solid #e6e6e6',
                borderRadius: 6,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                zIndex: 10,
                maxHeight: 180,
                overflowY: 'auto',
              }}>
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: i !== suggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                      background: i === selectedSuggest ? 'var(--selected)' : 'transparent',
                      transition: 'background 0.2s',
                    }}
                    onClick={() => handleSuggestionClick(s)}
                  >
                    {s.prompt}
                    <span style={{ float: 'right', color: '#aaa', fontSize: 12 }}>
                      {s.similarity.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <button onClick={handleSend} disabled={loading || !prompt.trim()} style={{ marginTop: 8, padding: '8px 24px', fontSize: 16 }}>
              发送
            </button>
          </div>
          {response && (
            <div style={{ marginTop: 16, background: '#e6f7ff', padding: 12, borderRadius: 8 }}>
              <b>AI 回答：</b>
              <div>{response}</div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
