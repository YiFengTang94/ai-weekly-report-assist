# CLAUDE.md
# Project Overview
AI 周报助手是一个面向个人工程师的 Web 应用，基于 Next.js 构建。能够从 GitHub 和飞书日历中自动采集工作数据，利用智谱 AI 进行智能总结，每周五自动生成结构化的中文周报，并通过飞书机器人推送。同时提供 Web 界面用于查看历史周报、手动触发生成和管理配置。
# Tech Stack
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS for styling
- NextAuth.js for GitHub OAuth
- ZHIPU API (via ZHIPU HTTP) for summarization
# Code Style
- Use server components by default, 'use client' only when needed
- API routes in app/api/, use Route Handlers
- Prefer named exports
- Error handling: always use try-catch in API routes
# Testing
- Run `npm run lint` before committing
- Test API routes with curl before building UI