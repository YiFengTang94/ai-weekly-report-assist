# AI 周报助手

一个面向个人工程师的智能周报生成工具，自动采集 GitHub 活动、调用智谱 AI 进行智能总结，生成结构化的中文周报。

## ✨ 特性

- 🔐 **GitHub OAuth 登录** — 使用 GitHub 账号一键登录
- 📊 **自动数据采集** — 采集本周 commits、PRs、issues 数据
- 🤖 **AI 智能总结** — 调用智谱 AI 将零散记录归纳为可读段落
- 📅 **智能分类** — 自动分类为"本周完成""进行中""会议与协作""下周计划"
- 💾 **本地存储** — 周报保存为 Markdown 文件，支持历史查阅
- ⏰ **定时生成** — 支持每周五自动生成（需配置 cron）
- 🎨 **现代 UI** — 基于 Tailwind CSS 的响应式界面

## 🚀 快速开始

### 前置要求
- Node.js 18+
- pnpm

### 安装

```bash
git clone https://github.com/yourusername/ai-weekly-report-assist.git
cd ai-weekly-report-assist
pnpm install
```

### 配置环境变量

1. 复制 `.env.local.example` 为 `.env.local`
2. 填入以下配置项：

```bash
# NextAuth (GitHub OAuth)
AUTH_SECRET=                # 运行: openssl rand -base64 32
AUTH_GITHUB_ID=             # GitHub OAuth App Client ID
AUTH_GITHUB_SECRET=         # GitHub OAuth App Client Secret

# 智谱 AI
ZHIPU_API_KEY=              # 从 https://open.bigmodel.cn 获取

# 可选：Cron 定时任务
GITHUB_TOKEN=               # GitHub PAT（Cron 使用）
GITHUB_USERNAME=            # GitHub 用户名
CRON_SECRET=                # Cron 访问密钥
```

### 创建 GitHub OAuth App

1. 访问 [GitHub OAuth App 创建页面](https://github.com/settings/developers)
2. 点击 **New OAuth App**
3. 填写表单：
   - **Application name**: AI 周报助手
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. 复制 **Client ID** 和 **Client Secret** 到 `.env.local`

### 启动开发服务器

```bash
pnpm dev
```

访问 `http://localhost:3000` 开始使用。

## 📖 使用

1. **登录** — 点击"使用 GitHub 登录"
2. **生成周报** — 点击"生成本周周报"按钮
3. **查看历史** — 点击"查看全部历史周报"浏览已生成的周报
4. **详情阅读** — 点击周报卡片查看完整内容

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 + React 19 |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 4 |
| 认证 | NextAuth.js v5 |
| GitHub API | Octokit |
| AI | 智谱 AI (GLM-5) |
| 包管理 | pnpm |

## 📁 项目结构

```
.
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── auth/          # NextAuth 路由
│   │   ├── report/        # 周报生成/查询路由
│   │   └── cron/          # 定时任务入口
│   ├── reports/           # 周报列表和详情页面
│   ├── page.tsx           # 仪表板首页
│   └── layout.tsx         # 根布局
├── components/            # React 组件
│   ├── auth-button.tsx    # 登录按钮
│   ├── generate-button.tsx # 生成按钮
│   ├── report-card.tsx    # 周报卡片
│   └── report-detail.tsx  # 周报详情
├── lib/                   # 服务层
│   ├── auth.ts            # NextAuth 配置
│   ├── collectors/        # 数据采集器
│   ├── summarizer/        # AI 总结器
│   ├── generators/        # 周报生成器
│   ├── publishers/        # 发布器
│   └── services/          # 业务逻辑
├── reports/               # 生成的周报存储目录
└── .env.local.example     # 环境变量示例
```

## 🔄 工作流程

```
用户登录 (GitHub OAuth)
    ↓
点击"生成周报"
    ↓
collectGitHubData() → 采集本周 commits/PRs/issues
    ↓
summarizeWithZhipu() → 调用智谱 AI 进行总结
    ↓
generateMarkdown() → 格式化为 Markdown
    ↓
saveToFile() → 保存到本地 ./reports/
    ↓
展示周报给用户
```

## 🚀 部署

### Vercel 部署

```bash
# 登录 Vercel
pnpm add -g vercel

# 部署
vercel
```

**注意**：Vercel 的文件系统是临时的，生产环境建议配置数据库存储。

## 📝 环境变量说明

| 变量 | 说明 | 必需 |
|------|------|------|
| `AUTH_SECRET` | NextAuth 密钥 | ✅ |
| `AUTH_GITHUB_ID` | GitHub OAuth App ID | ✅ |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App Secret | ✅ |
| `ZHIPU_API_KEY` | 智谱 AI API Key | ✅ |
| `GITHUB_TOKEN` | GitHub PAT（Cron 使用） | ❌ |
| `GITHUB_USERNAME` | GitHub 用户名（Cron 使用） | ❌ |
| `CRON_SECRET` | Cron 访问密钥 | ❌ |
| `REPORT_OUTPUT_DIR` | 周报保存目录 | 默认: `./reports` |

## 🐛 常见问题

**Q: 为什么登录后仍无法生成周报？**
A: 确保已填入 `ZHIPU_API_KEY`，并且 GitHub OAuth 的 scope 包含 `repo` 权限。

**Q: 周报内容为空？**
A: 检查本周是否有 GitHub 活动，或智谱 API 是否正常响应。查看浏览器控制台了解错误详情。

**Q: 如何设置自动定时生成？**
A: 填入 `GITHUB_TOKEN`、`GITHUB_USERNAME`、`CRON_SECRET`，然后配置外部 cron 服务（如 Vercel Cron）调用 `GET /api/cron`。

## 📈 后续扩展

- [ ] 飞书日历采集
- [ ] 飞书机器人推送
- [ ] 数据库存储（替代文件系统）
- [ ] 会议纪要自动解析
- [ ] 周报模板自定义
- [ ] 历史周报对比分析

## 📄 许可证

MIT

## 🤝 贡献

欢迎 Pull Request 和 Issue！

---

**Made with ❤️ by AI Weekly Report Assistant**
