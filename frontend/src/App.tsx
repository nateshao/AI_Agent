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

const API_BASE = '';

function App() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState('openai');
  const [suggestions, setSuggestions] = useState<PromptSuggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId) {
      fetch(`${API_BASE}/conversation/${conversationId}/messages`)
        .then(res => res.json())
        .then(setMessages);
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  // 智能补全请求
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
        });
    } else {
      setSuggestions([]);
      setShowSuggest(false);
    }
  }, [prompt]);

  // 点击外部关闭建议
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
  };

  return (
    <div className="App" style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <h2>AI Prompt Agent 控制台</h2>
      <div style={{ marginBottom: 12 }}>
        <button onClick={startConversation} disabled={loading}>
          新建会话
        </button>
        <select value={model} onChange={e => setModel(e.target.value)} style={{ marginLeft: 12 }}>
          <option value="openai">OpenAI</option>
          <option value="claude">Claude</option>
          <option value="local">本地模型</option>
        </select>
      </div>
      <div style={{ minHeight: 200, background: '#f7f7f7', padding: 12, borderRadius: 8, marginBottom: 12 }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ textAlign: msg.role === 'user' ? 'right' : 'left', margin: '8px 0' }}>
            <b>{msg.role === 'user' ? '🧑' : '🤖'}：</b> {msg.content}
          </div>
        ))}
        {loading && <div>AI 正在思考...</div>}
      </div>
      <div style={{ position: 'relative' }} ref={suggestRef}>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={3}
          style={{ width: '100%', marginBottom: 8 }}
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
            background: '#fff',
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
                style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: i !== suggestions.length - 1 ? '1px solid #f0f0f0' : 'none' }}
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
        <button onClick={handleSend} disabled={loading || !prompt.trim()}>
          发送
        </button>
      </div>
      {response && (
        <div style={{ marginTop: 16, background: '#e6f7ff', padding: 12, borderRadius: 8 }}>
          <b>AI 回答：</b>
          <div>{response}</div>
        </div>
      )}
    </div>
  );
}

export default App;
