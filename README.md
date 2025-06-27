# AI Prompt Agent

> 🚀 下一代智能体平台：自动补全提示词、多模型对话、任务分解、多步推理、工具调用、记忆、插件扩展，一站式 Agent 体验！

---

## ✨ 项目简介

AI Prompt Agent 是一个面向开发者和 AI 爱好者的智能体平台，集成了 LLM 多模型调用、智能提示词补全、任务分解与多步推理、工具/插件机制、长期记忆、主动建议、多 Agent 协作、任务链自动化等高级 Agent 能力。支持 Web UI 交互，易于二次开发和扩展。

---

## 🧩 核心特性

- **Prompt 智能补全**：基于语义检索的提示词推荐，提升提问效率
- **多模型适配**：支持 OpenAI、Claude、本地模型等多种 LLM
- **任务分解与多步推理**：自动将复杂目标拆解为子任务，逐步执行并汇总
- **工具/插件调用**：内置网页搜索、可扩展代码执行、知识库检索等插件
- **长期记忆**：Agent 可记住用户偏好、历史任务，跨会话引用
- **主动建议与反问**：信息不足时智能补充提问或建议
- **多Agent协作**：支持多专家Agent协同解决复杂问题
- **任务链自动化**：支持用户自定义多步任务链，自动串联执行
- **Web UI 控制台**：美观易用，支持主题切换、API Key 管理、会话导入导出、批量操作、消息搜索等

---

## 🏗️ 架构总览

```
AI_Agent/
├── app/                # FastAPI 后端（API、模型、Agent、工具、记忆等）
├── frontend/           # React + TypeScript 前端（Web 控制台）
├── requirements.txt    # Python 依赖
└── README.md           # 项目说明
```

- **后端**：FastAPI + SQLite，支持 LLM 调用、embedding 检索、Agent推理、工具注册、记忆管理等
- **前端**：React + TypeScript，支持多模式对话、Agent链路可视化、插件扩展

---

## 🚀 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
cd frontend
npm install
```

### 2. 配置 OpenAI API Key
```bash
export OPENAI_API_KEY=你的key
```

### 3. 初始化数据库
```bash
python app/prompts/init_db.py
```

### 4. 启动服务
```bash
# 启动后端
uvicorn app.main:app --reload
# 启动前端
cd frontend
npm start
```

### 5. 访问 Web 控制台
浏览器打开 [http://localhost:3000](http://localhost:3000)

---

## 🖥️ 主要功能界面

- **Prompt 智能补全**：输入时自动推荐相关提示词
- **多模型对话**：支持 OpenAI、Claude、本地模型切换
- **Agent模式**：任务分解、推理链、工具调用、记忆、任务链自动化
- **会话管理**：历史会话、导入导出、批量删除、重命名
- **API Key 管理**：本地存储，安全易用
- **主题切换**：明暗模式一键切换
- **插件扩展**：支持自定义工具/插件

---

## 🧠 Agent 智能体能力

- **任务分解与多步推理**：输入复杂目标，Agent 自动拆解并逐步执行
- **工具调用与插件机制**：如网页搜索、代码执行、知识库检索等
- **记忆与长期上下文**：Agent 可记住并引用历史信息
- **主动建议与反问**：信息不足时主动补充提问
- **多Agent协作**：可选不同专家Agent协同解决问题
- **任务链与自动化**：支持多步任务链自动串联执行

---

## 🛠️ 二次开发与扩展

- **新增模型**：在 `app/models/` 下添加适配器，注册到主路由即可
- **自定义工具/插件**：在 `app/main.py` 的 AGENT_TOOLS 注册新工具，支持任意 Python 函数
- **扩展Agent类型**：在 AGENT_TYPES 增加新专家Agent，支持多角色协作
- **前端扩展**：基于 React 组件，易于自定义 UI/交互

---

## 📦 示例交互

- **任务分解**：
  > 目标：帮我写一份AI创业计划书
  > 任务链：市场分析\n技术方案\n团队建议
  > Agent自动分解并逐步生成每步内容

- **工具调用**：
  > 目标：请帮我查找2024年AI创业趋势
  > Agent自动调用网页搜索工具，插入搜索结果

- **记忆引用**：
  > 目标：请基于我之前的偏好推荐AI产品
  > Agent自动引用记忆库内容

---

## 🤝 贡献与交流

- 欢迎 PR、Issue、建议与插件投稿！
- QQ/微信群、GitHub Discussions、邮件等多渠道交流

---

## 📄 License

MIT 