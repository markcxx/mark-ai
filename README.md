<div align="center">

<img src="public/images/markai.svg" alt="MarkAI Logo" width="80" height="80" />

# MarkAI

**现代化、可自托管的 AI 对话客户端，支持任意 OpenAI 兼容接口。**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06b6d4?logo=tailwindcss)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[功能特性](#-功能特性) · [快速开始](#-快速开始) · [配置说明](#-配置说明) · [部署](#-部署) · [技术栈](#-技术栈)

</div>

---

## ✨ 功能特性

### 多模型、多供应商

接入**任意 OpenAI 兼容接口** —— OpenAI、DeepSeek、OpenRouter、Ollama、vLLM，或你自己的私有端点。同时原生支持 **Google Gemini**。只需几个环境变量即可添加自定义供应商。

### Agent 联网搜索

内置网页搜索（Tavily）和网页阅读（Firecrawl）工具。模型**自主决定**何时搜索、阅读哪些页面，单次回答最多可进行 **5 轮**工具调用链。

### 深度思考展示

完整支持推理模型（DeepSeek-R1、QwQ 等）。思考过程实时流式输出，可折叠面板显示，附带耗时统计。

### 丰富的 Markdown 渲染

完整 GFM 支持：语法高亮代码块（150+ 语言）、长代码折叠、一键复制、提示块（admonition）、表格等。

### HTML 即时预览

`html` 代码块自动显示预览按钮，在沙盒侧面板中渲染，支持源码/预览切换、全屏、下载。

### 会话管理

对话持久化到本地 SQLite 数据库。按时间分组展示，支持收藏、重命名、AI 智能重命名，集成浏览器历史记录。

### 多样化导出

- **图片导出** —— 导出为高清 PNG（2x 分辨率），保留完整样式
- **JSON 导出** —— 结构化数据，包含完整消息历史和元信息

### 响应式 & 主题切换

桌面端与移动端完美适配。完整深色模式，自动跟随系统偏好。Framer Motion 驱动的流畅动画。

### 隐私优先

完全在你的机器上运行。无遥测、无第三方分析。API 密钥和对话数据绝不离开你的服务器。

---

## 🚀 快速开始

**环境要求：** Node.js 20+

```bash
# 克隆仓库
git clone https://github.com/your-username/markai.git
cd markai

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入你的 API Key

# 启动开发服务器
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000) 即可使用。

---

## ⚙ 配置说明

所有配置通过 `.env.local` 中的环境变量完成。

### 内置供应商

| 供应商   | API Key            | 模型列表          | Base URL            |
| -------- | ------------------ | ----------------- | ------------------- |
| Gemini   | `GEMINI_API_KEY`   | `GEMINI_MODELS`   | `GEMINI_BASE_URL`   |
| OpenAI   | `OPENAI_API_KEY`   | `OPENAI_MODELS`   | `OPENAI_BASE_URL`   |
| DeepSeek | `DEEPSEEK_API_KEY` | `DEEPSEEK_MODELS` | `DEEPSEEK_BASE_URL` |

```env
# 示例：接入 DeepSeek
DEEPSEEK_API_KEY=sk-xxxxx
DEEPSEEK_MODELS=deepseek-chat,deepseek-reasoner
```

### 自定义供应商

通过 `AI_PROVIDERS` 添加任意 OpenAI 兼容的供应商：

```env
AI_PROVIDERS=openrouter,moonshot

OPENROUTER_API_KEY=sk-or-xxxxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODELS=anthropic/claude-sonnet-4,google/gemini-2.5-pro

MOONSHOT_API_KEY=sk-xxxxx
MOONSHOT_BASE_URL=https://api.moonshot.cn/v1
MOONSHOT_MODELS=moonshot-v1-auto
```

### 联网搜索

```env
TAVILY_API_KEY=tvly-xxxxx        # 网页搜索
FIRECRAWL_API_KEY=fc-xxxxx       # 网页阅读（可选，缺省回退到 Tavily）
```

### 其他选项

| 变量                              | 默认值                | 说明                                             |
| --------------------------------- | --------------------- | ------------------------------------------------ |
| `MARKAI_SQLITE_PATH`              | `.data/markai.sqlite` | SQLite 数据库路径                                |
| `MARKAI_CONVERSATION_TITLE_MODEL` | —                     | 自动生成会话标题的模型（格式：`provider/model`） |

---

## 🚢 部署

### 生产构建

```bash
npm run build
npm start
```

项目使用 Next.js `standalone` 输出模式，构建产物为自包含的 Node.js 服务，可直接容器化部署。

### Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

```bash
docker build -t markai .
docker run -p 3000:3000 --env-file .env.local markai
```

---

## 🛠 技术栈

| 层级     | 技术                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------- |
| 框架     | [Next.js 15](https://nextjs.org/)（App Router, Standalone）                                               |
| 视图层   | [React 19](https://react.dev/)                                                                            |
| 状态管理 | [Zustand 5](https://zustand.docs.pmnd.rs/)                                                                |
| 样式     | [Tailwind CSS 4](https://tailwindcss.com/)                                                                |
| 动画     | [Motion](https://motion.dev/)（Framer Motion）                                                            |
| Markdown | [react-markdown](https://github.com/remarkjs/react-markdown) + remark-gfm                                 |
| 代码高亮 | [react-syntax-highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter)（Prism） |
| 图标     | [Lucide](https://lucide.dev/) + [@lobehub/icons](https://github.com/lobehub/lobe-icons)                   |
| 数据库   | SQLite（Node.js 内置 `node:sqlite`）                                                                      |
| 联网搜索 | [Tavily](https://tavily.com/) + [Firecrawl](https://firecrawl.dev/)                                       |
| 图片导出 | [@zumer/snapdom](https://github.com/nicepkg/snapdom)                                                      |
| 类型系统 | TypeScript 5.9, strict 模式                                                                               |

---

## 📁 项目结构

```
markai/
├── app/
│   ├── api/
│   │   ├── chat/            # 对话流式 API（Agent 工具调用循环）
│   │   ├── models/          # 模型列表 API
│   │   └── sessions/        # 会话 CRUD API
│   ├── [sessionId]/         # 会话页面
│   └── page.tsx             # 首页
├── components/
│   ├── chat/                # 对话 UI 组件
│   └── ui/                  # 通用 UI 组件
├── lib/
│   ├── chat/                # 对话类型与工具函数
│   ├── db/                  # SQLite 数据库层
│   ├── search/              # Tavily & Firecrawl 集成
│   └── models.ts            # 多供应商模型配置
├── stores/                  # Zustand 状态管理（chat, session, UI）
└── public/                  # 静态资源
```

---

## 📄 开源协议

[MIT](LICENSE)

---

<div align="center">

基于 **Next.js** 和 **React** 构建，由你选择的模型驱动。

</div>
