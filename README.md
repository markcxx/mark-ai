<p align="center">
  <img src="public/images/markai.svg" alt="MarkAI Logo" width="80" height="80" />
</p>

<h1 align="center">MarkAI</h1>

<p align="center"><strong>可自托管的 AI 生产力工作台</strong></p>

<p align="center">将多模型对话、深度思考、联网搜索、文件理解、内容生成和数据可视化集中在一个专注的工作界面中。</p>

<p align="center">
  <a href="package.json"><img src="https://img.shields.io/badge/version-0.1.6-111827" alt="Version 0.1.6" /></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js 15" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61dafb?logo=react" alt="React 19" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript" alt="TypeScript 5.9" /></a>
</p>

<p align="center">
  <a href="#产品能力">产品能力</a> ·
  <a href="#核心功能">核心功能</a> ·
  <a href="#模型提供商">模型提供商</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#运行模式与部署">部署</a> ·
  <a href="#开发与验证">开发</a>
</p>

<details>
<summary><kbd>目录</kbd></summary>

- [产品能力](#产品能力)
- [核心功能](#核心功能)
  - [专注的多模型对话](#专注的多模型对话)
  - [完整的消息与推理呈现](#完整的消息与推理呈现)
  - [按会话启用的内置工具](#按会话启用的内置工具)
  - [统一的模型接入](#统一的模型接入)
  - [文件理解与管理](#文件理解与管理)
- [更多已实现能力](#更多已实现能力)
- [模型提供商](#模型提供商)
- [快速开始](#快速开始)
- [运行模式与部署](#运行模式与部署)
- [配置说明](#配置说明)
- [数据与隐私](#数据与隐私)
- [开发与验证](#开发与验证)

</details>

## 产品能力

MarkAI 不是只包装一个模型接口的聊天页面。它以会话为工作单元，把模型、文件、工具、预览、设置和管理能力放在同一套工作流中：用户可以选择不同供应商的模型完成对话，让模型搜索网页或读取附件，并把结果继续整理为文档、表格、图表、流程图或脑图。

| 能力             | 已实现内容                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------- |
| **多模型对话**   | Gemini 原生 runtime、OpenAI-compatible runtime、流式输出、深度思考、消息变体和 token 用量 |
| **上下文与文件** | 上下文窗口裁剪、附件文本注入、PDF/DOCX/XLSX/CSV 解析、本地或 R2 存储                      |
| **搜索与引用**   | Tavily 搜索、Firecrawl/Tavily 网页阅读、来源引用和内网地址保护                            |
| **内容生成**     | Word、Excel、ECharts、Mermaid、Markmap 和可靠计算工具                                     |
| **工作区**       | 会话历史、收藏、AI 标题、宽屏模式、消息选择、迷你地图和导出                               |
| **账户与运营**   | 游客草稿、邮箱/SSO 登录、注册策略、等候名单、用户管理和审计记录                           |
| **自托管**       | SQLite 本地模式，或 PostgreSQL + Better Auth + Cloudflare R2 云端模式                     |

## 核心功能

### 专注的多模型对话

聊天工作台保持内容优先：桌面端提供可调整宽度的会话侧栏，主工作面板集中承载消息、模型选择、联网搜索、附件和输入操作；移动端则切换为边到边布局和临时侧栏。

- 模型使用 `provider/model` 组合标识，同名模型可以来自不同供应商。
- 支持停止、继续和重新生成，多个回复版本保留完整内容、推理、工具结果和用量。
- 切换会话会终止当前请求，并使用请求 ID 防止旧响应覆盖新会话。
- 普通模式约束阅读宽度，宽屏模式同步扩展消息列表和输入区。

![MarkAI 聊天工作台](public/images/readme/chat-workbench.png)

### 完整的消息与推理呈现

MarkAI 将正文、推理、工具调用、生成文件和翻译保存为带类型的消息片段。OpenAI-compatible 服务既可以返回结构化 reasoning，也可以在正文中使用 `<think>` 或 `<lobeThinking>` 标签；服务端会在任意 SSE 分块边界上完成归一化，避免推理标签泄漏到最终回答。

- 实时展示推理过程、推理耗时、生成耗时和 token 用量。
- 支持 GFM、代码高亮、表格、引用、HTML 沙盒预览和来源列表。
- `echarts`、`mermaid` 和 `markmap` 代码块会渲染为交互式内容。
- 消息支持复制、编辑、删除、翻译、选择到此处和批量操作。

![MarkAI 消息、推理与用量展示](public/images/readme/message-capabilities.png)

<p align="center">
  <img src="public/images/readme/mobile-workbench.png" alt="MarkAI 移动端聊天工作台" width="300" />
</p>
<p align="center"><sub>移动端保留推理、消息操作、模型状态和安全区输入体验</sub></p>

### 按会话启用的内置工具

插件中心管理内置 Tool 与 Skill。工具先安装到当前账户，再按会话启用；只有已安装且当前会话启用的函数和系统提示会进入模型上下文。

- **Word 文档生成**：将结构化 Markdown 生成可下载的 DOCX。
- **Excel 工作簿生成**：生成多工作表、自动列宽的 XLSX。
- **轻量计算器**：执行数学表达式、数字统计和常用单位换算。
- **ECharts 可视化**：生成可交互的 2D/3D 图表配置。
- **Mermaid 流程图**：生成流程图、时序图、状态图、ER 图和甘特图。
- **Markmap 脑图**：将主题和知识层级转换为可缩放、可折叠的脑图。

![MarkAI 插件中心](public/images/readme/plugin-center.png)

### 统一的模型接入

模型设置将站点提供商、用户自定义提供商和模型列表统一到同一界面。云端用户可以独立启用提供商、修改 Base URL、保存加密 API Key，并设置默认聊天模型和翻译模型。

- 原生支持 Google Gemini。
- 支持所有实现 OpenAI Chat Completions 协议的服务。
- 支持环境变量、提供商模板、自动发现和 `AI_MODEL_CONFIGS` 逐模型配置。
- 用户保存的 API Key 仅在服务端解密使用，不返回客户端。

![MarkAI AI 提供商设置](public/images/readme/provider-settings.png)

### 文件理解与管理

文件管理覆盖上传、使用量、搜索、预览、下载和删除。发送消息时，服务端读取当前附件并注入可用文本；本地模式使用服务器文件目录，云端模式使用 Cloudflare R2 私有桶。

- 支持 PDF、DOCX、XLSX/CSV 和常见文本格式的内容提取。
- 支持图片、文档、表格和演示文稿附件。
- 单文件大小、文件数量和总存储容量均可配置。
- 生成的 Word 和 Excel 文件也进入统一文件存储和下载流程。

![MarkAI 文件管理](public/images/readme/file-manager.png)

## 更多已实现能力

### 会话与工作区

- 会话按时间分组，支持收藏、手动重命名和 AI 自动标题。
- 浏览器地址与当前会话同步，可直接访问 `/{sessionId}`。
- revision 冲突检查降低多标签页或并发保存造成的数据覆盖风险。
- 支持会话 JSON/PNG 导出、消息选择、迷你地图和全宽阅读。

### 游客、账户与个性化

- 云端未登录用户可以先输入草稿，在发送、上传或访问历史时再登录。
- 游客草稿在登录后恢复到完整聊天工作台。
- 支持邮箱验证码、邮箱密码、密码重置以及 Google/GitHub SSO。
- 注册策略支持开放注册、等候名单和关闭注册。
- 设置中心包含主题、语言、字体大小、响应动画、减少动态效果、默认模型和翻译模型。

### 管理后台

- 总览页面展示用户、会话、消息、文件和活跃趋势。
- 用户管理支持搜索、筛选、批量操作、角色调整、封禁和删除。
- 用户详情可以管理资料、登录会话、对话与文件。
- 等候名单支持审核、拒绝、邀请、批量操作和邮件发送结果。
- 审计面板记录管理员、目标对象、操作内容和时间。

### 响应式与性能

- 支持亮色、暗色和跟随系统主题，以及用户选择的交互主色。
- 适配 320px 以上屏幕、触摸操作和移动安全区。
- 可视化、预览和导出等重型依赖按需加载。
- `data-reduce-motion` 会缩短全局动画和过渡时间。

## 模型提供商

### 内置提供商模板

云端模型管理内置以下 16 个提供商模板。除 Gemini 使用原生 runtime 外，其余模板均使用 OpenAI-compatible runtime。

<table>
  <tr>
    <td align="center"><img src="public/images/model-icons/gemini-color.svg" width="30" alt="Google Gemini" /><br /><strong>Google Gemini</strong></td>
    <td align="center"><img src="public/images/model-icons/openai.svg" width="30" alt="OpenAI" /><br /><strong>OpenAI</strong></td>
    <td align="center"><img src="public/images/model-icons/deepseek.svg" width="30" alt="DeepSeek" /><br /><strong>DeepSeek</strong></td>
    <td align="center"><img src="public/images/model-icons/minimax.svg" width="30" alt="MiniMax" /><br /><strong>MiniMax</strong></td>
  </tr>
  <tr>
    <td align="center"><img src="public/images/model-icons/moonshot.svg" width="30" alt="Moonshot AI" /><br /><strong>Moonshot AI</strong></td>
    <td align="center"><img src="public/images/model-icons/qwen.svg" width="30" alt="阿里云百炼" /><br /><strong>阿里云百炼</strong></td>
    <td align="center"><img src="public/images/model-icons/zhipu.svg" width="30" alt="智谱 AI" /><br /><strong>智谱 AI</strong></td>
    <td align="center"><img src="public/images/model-icons/openrouter.svg" width="30" alt="OpenRouter" /><br /><strong>OpenRouter</strong></td>
  </tr>
  <tr>
    <td align="center"><img src="public/images/model-icons/siliconcloud.svg" width="30" alt="硅基流动" /><br /><strong>硅基流动</strong></td>
    <td align="center"><img src="public/images/model-icons/volcengine.svg" width="30" alt="火山方舟" /><br /><strong>火山方舟</strong></td>
    <td align="center"><img src="public/images/model-icons/groq.svg" width="30" alt="Groq" /><br /><strong>Groq</strong></td>
    <td align="center"><img src="public/images/model-icons/mistral.svg" width="30" alt="Mistral AI" /><br /><strong>Mistral AI</strong></td>
  </tr>
  <tr>
    <td align="center"><img src="public/images/model-icons/together.svg" width="30" alt="Together AI" /><br /><strong>Together AI</strong></td>
    <td align="center"><img src="public/images/model-icons/xai.svg" width="30" alt="xAI" /><br /><strong>xAI</strong></td>
    <td align="center"><img src="public/images/model-icons/huggingface.svg" width="30" alt="HuggingFace" /><br /><strong>HuggingFace</strong></td>
    <td align="center"><img src="public/images/model-icons/infinigence.svg" width="30" alt="无问芯穹" /><br /><strong>无问芯穹</strong></td>
  </tr>
</table>

每个模板提供默认 Base URL、runtime 和部分推荐模型 ID。管理员或用户仍需填写自己的 API Key，并可自由修改模型列表。

### 环境变量预设

本地部署可直接使用以下 6 组环境变量预设：

| 提供商        | API Key               | 模型列表             | 可选 Base URL          |
| ------------- | --------------------- | -------------------- | ---------------------- |
| Google Gemini | `GEMINI_API_KEY`      | `GEMINI_MODELS`      | `GEMINI_BASE_URL`      |
| OpenAI        | `OPENAI_API_KEY`      | `OPENAI_MODELS`      | `OPENAI_BASE_URL`      |
| DeepSeek      | `DEEPSEEK_API_KEY`    | `DEEPSEEK_MODELS`    | `DEEPSEEK_BASE_URL`    |
| HuggingFace   | `HUGGINGFACE_API_KEY` | `HUGGINGFACE_MODELS` | `HUGGINGFACE_BASE_URL` |
| 阿里云百炼    | `BAILIAN_API_KEY`     | `BAILIAN_MODELS`     | `BAILIAN_BASE_URL`     |
| 无问芯穹      | `INFINIAI_API_KEY`    | `INFINIAI_MODELS`    | `INFINIAI_BASE_URL`    |

其他 OpenAI-compatible 服务可通过 `AI_PROVIDERS` 映射对应的 `*_API_KEY`、`*_BASE_URL` 和 `*_MODELS`，也可使用 `AI_MODEL_CONFIGS` 进行逐模型配置。

## 快速开始

### 环境要求

- Node.js 22 LTS
- npm 10+
- 至少一个可用的模型 API Key

```bash
git clone https://github.com/markcxx/mark-ai.git
cd mark-ai
npm install
cp .env.example .env.local
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。`.env.example` 默认启用 SQLite 本地模式，只需填写模型配置即可开始使用。

以 DeepSeek 为例：

```env
DEEPSEEK_API_KEY="sk-..."
DEEPSEEK_MODELS="deepseek-chat,deepseek-reasoner"
```

自定义 OpenAI-compatible 服务：

```env
AI_PROVIDERS="openrouter,local"

OPENROUTER_API_KEY="sk-or-..."
OPENROUTER_BASE_URL="https://openrouter.ai/api/v1"
OPENROUTER_MODELS="anthropic/claude-sonnet-4,google/gemini-2.5-pro"

LOCAL_API_KEY="local"
LOCAL_BASE_URL="http://127.0.0.1:11434/v1"
LOCAL_MODELS="qwen3:8b"
```

## 运行模式与部署

### 本地模式

设置 `MARKAI_SQLITE_PATH` 时启用本地模式，无需账户系统：

```env
MARKAI_SQLITE_PATH=".data/markai.sqlite"
MARKAI_LOCAL_FILES_DIR=".data/files"
```

会话、设置、工具状态和用户文件都保存在当前服务器上。

### 云端模式

设置 `DATABASE_URL` 并删除或留空 `MARKAI_SQLITE_PATH` 时启用云端模式：

```env
MARKAI_SQLITE_PATH=""
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
AUTH_SECRET="使用 openssl rand -base64 32 生成"
APP_URL="https://ai.example.com"
```

附件与头像使用 Cloudflare R2：

```env
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_PRIVATE_BUCKET=""
R2_PUBLIC_BUCKET=""
R2_PUBLIC_BASE_URL="https://files.example.com"
```

首次部署数据库结构：

```bash
npm run db:migrate
```

### Docker

仓库内的 [`Dockerfile`](Dockerfile) 使用 Node.js 22 和 Next.js standalone 输出：

```bash
docker build -t markai:0.1.6 .
docker run --rm -p 3000:3000 --env-file .env.local markai:0.1.6
```

生产 Compose 示例位于 [`deploy/compose.yaml`](deploy/compose.yaml)，默认将服务绑定到宿主机 `127.0.0.1:3001`，适合放在 Nginx、Caddy 或其他反向代理之后。

### 直接运行

```bash
npm run build
npm start
```

## 配置说明

完整配置和安全占位值见 [`.env.example`](.env.example)，生产部署示例见 [`deploy/env.production.example`](deploy/env.production.example)。

| 变量                                | 用途                                        |
| ----------------------------------- | ------------------------------------------- |
| `AI_PROVIDERS` / `AI_MODEL_CONFIGS` | 自定义模型供应商和逐模型配置                |
| `MARKAI_CONVERSATION_TITLE_MODEL`   | 自动生成会话标题，格式为 `provider/modelId` |
| `MARKAI_TRANSLATION_MODEL`          | 默认翻译模型，格式为 `provider/modelId`     |
| `TAVILY_API_KEY`                    | 联网搜索及网页读取回退                      |
| `FIRECRAWL_API_KEY`                 | 网页正文提取，可配置多个 Key                |
| `AUTH_REGISTRATION_MODE`            | `open`、`waitlist` 或 `closed`              |
| `AUTH_ADMIN_EMAILS`                 | 初始管理员邮箱列表                          |
| `AUTH_SSO_PROVIDERS`                | 启用 `google`、`github` SSO                 |
| `SMTP_*`                            | 验证码、邀请和密码重置邮件                  |
| `CREDENTIAL_ENCRYPTION_KEY`         | 加密用户保存的供应商 API Key                |
| `MARKAI_MAX_FILE_BYTES`             | 单文件大小限制                              |
| `MARKAI_MAX_FILE_COUNT`             | 云端用户文件数量限制                        |
| `MARKAI_MAX_STORAGE_BYTES`          | 云端用户存储容量限制                        |

`CREDENTIAL_ENCRYPTION_KEY` 和 `AUTH_SECRET` 在生产环境中必须妥善保管。更换加密密钥后，已有的用户模型 API Key 将无法解密。

## 数据与隐私

MarkAI 不包含遥测或第三方分析代码。实际数据流取决于启用的功能：

- 会话和文件保存在配置的 SQLite、本地目录、PostgreSQL 或 R2 中。
- 发起模型请求时，当前对话上下文和相关附件文本会发送到所选模型供应商。
- 启用联网搜索或网页阅读时，查询或 URL 会发送到 Tavily、Firecrawl 及目标网站。
- 用户自定义供应商的 API Key 仅在服务端加密存储和解密使用，不会返回客户端。

部署者应根据实际供应商、地区和组织要求制定隐私政策与数据保留策略。

## 开发与验证

### 技术栈

| 层级 | 技术                                                  |
| ---- | ----------------------------------------------------- |
| 应用 | Next.js 15 App Router、React 19、TypeScript 5.9       |
| UI   | Tailwind CSS 4、Base UI、Lucide、Motion               |
| 状态 | Zustand 5                                             |
| AI   | OpenAI-compatible API、Google GenAI SDK               |
| 内容 | React Markdown、Prism、ECharts GL、Mermaid、Markmap   |
| 数据 | SQLite（本地）、Drizzle ORM + Neon/PostgreSQL（云端） |
| 认证 | Better Auth                                           |
| 文件 | 本地文件系统、Cloudflare R2、PDF/Mammoth/SheetJS/DOCX |
| 测试 | Vitest                                                |

### 自动化测试

```bash
npm test
```

开发时监听相关文件：

```bash
npm run test:watch
```

当前测试覆盖推理标签流式解析、上下文裁剪、消息与 revision 校验、token 用量合并和翻译输出清洗。运行测试不依赖 GitHub Actions。

提交代码前建议运行：

```bash
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

不要在同一个 checkout 中同时运行 `next dev` 和 `next build`，两者都会写入 `.next`。

### 数据库迁移

修改 Drizzle schema 后：

```bash
npm run db:generate
npm run db:migrate
```

迁移文件位于 `drizzle/migrations/`，应与 schema 变更一起提交。

### 项目结构

```text
app/                    页面、布局和 API Route Handlers
components/chat/        聊天工作台和消息渲染
components/admin/       管理后台
components/ui/          MarkAI 通用 UI 原语
hooks/                  响应式、附件和滚动 Hooks
lib/chat/               聊天协议、存储、上下文与供应商 runtime
lib/db/                 Drizzle schema 和数据库连接
lib/storage/            本地文件、R2 和 Office/PDF 解析
lib/tools/              内置工具注册、执行与持久化
stores/                 Zustand 状态与聊天流式控制
public/images/          Logo、模型品牌图标和 README 截图
drizzle/migrations/     PostgreSQL 数据库迁移
deploy/                 生产环境 Compose 与部署脚本
```
