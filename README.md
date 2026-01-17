# Personal Blog

一个基于 Astro 构建的现代化个人博客系统，支持中英双语、深色模式、评论系统和管理后台。

## 功能特性

- **SSR 渲染** - 基于 Astro + Node.js 适配器的服务端渲染
- **中英双语** - 完整的国际化支持
- **深色模式** - 支持亮色/深色/跟随系统三种主题
- **评论系统** - 支持 @ 提及功能的评论系统
- **管理后台** - 博客文章的增删改查
- **Markdown** - 支持 GFM 语法和代码高亮
- **响应式设计** - 适配桌面和移动设备
- **Docker 部署** - 一键容器化部署

## 技术栈

- **前端框架**: Astro 5.x + React 19
- **样式**: Tailwind CSS 4.x
- **后端**: Express.js (API 服务)
- **语法高亮**: Shiki
- **部署**: Docker + Docker Compose

## 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器 (前端 + API)
npm run dev

# 仅启动前端
npm run dev:astro

# 仅启动 API 服务
npm run dev:server
```

访问 http://localhost:4321 查看网站。

### 生产构建

```bash
# 构建
npm run build

# 预览生产版本
npm run preview
```

## Docker 部署

### 使用 Docker Compose (推荐)

```bash
# 构建并启动
docker compose up -d --build

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

### 环境变量

创建 `.env` 文件配置环境变量：

```env
# 管理员密码 (运行时变量)
ADMIN_PASSWORD=your_secure_password

# 以下为构建时变量 - 修改后需重新构建镜像

# 社交链接 (格式: type:url,type:url)
PUBLIC_SOCIAL_LINKS=github:https://github.com/yourusername,email:mailto:your@email.com

# 网站信息
PUBLIC_SITE_TITLE=My Blog
PUBLIC_SITE_DESCRIPTION=A personal blog
PUBLIC_SITE_AUTHOR=Your Name
PUBLIC_SHOW_ADMIN_LINK=false
PUBLIC_COPYRIGHT_START_YEAR=2024
```

> **注意**: `PUBLIC_*` 开头的变量是 Astro 构建时变量。修改这些变量后需要重新构建 Docker 镜像：
> ```bash
> docker compose up -d --build
> ```

支持的社交平台：
- `github` - GitHub
- `twitter` - Twitter/X
- `email` - 邮箱
- `linkedin` - LinkedIn
- `weibo` - 微博
- `bilibili` - Bilibili
- `youtube` - YouTube
- `instagram` - Instagram
- `website` - 个人网站

## 项目结构

```
├── src/
│   ├── components/     # React/Astro 组件
│   ├── content/        # 博客内容 (Markdown)
│   ├── layouts/        # 页面布局
│   ├── lib/            # 工具函数和配置
│   ├── pages/          # 页面路由
│   │   ├── api/        # API 代理端点
│   │   ├── blog/       # 博客页面
│   │   ├── en/         # 英文页面
│   │   └── admin/      # 管理后台
│   └── styles/         # 全局样式
├── server/             # Express API 服务
├── public/             # 静态资源
├── Dockerfile          # Docker 镜像配置
└── docker-compose.yml  # Docker Compose 配置
```

## 博客文章

博客文章存放在 `src/content/blog/` 目录，使用 Markdown 格式：

```markdown
---
title: "文章标题"
description: "文章描述"
pubDate: "2024-01-15"
category: "tech"
tags: ["标签1", "标签2"]
draft: false
---

文章正文内容...
```

### 支持的分类

- `tech` - 技术
- `life` - 生活
- `thoughts` - 随想
- `tutorial` - 教程
- `reading` - 读书

## 管理后台

访问 `/admin` 进入管理后台，使用环境变量 `ADMIN_PASSWORD` 设置的密码登录。

功能：
- 创建/编辑/删除博客文章
- 删除评论（需要管理员权限）

## API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/posts` | GET | 获取所有文章 |
| `/api/posts` | POST | 创建新文章 |
| `/api/posts/:slug` | GET | 获取单篇文章 |
| `/api/posts/:slug` | DELETE | 删除文章 |
| `/api/comments` | GET | 获取评论 |
| `/api/comments` | POST | 发表评论 |
| `/api/comments/:slug/:id` | DELETE | 删除评论 |
| `/api/auth/login` | POST | 管理员登录 |
| `/api/auth/verify` | GET | 验证登录状态 |

## 主题配置

在 `src/lib/site.config.ts` 中配置网站信息：

```typescript
export const siteConfig = {
  title: 'Personal Blog',
  description: '一个简约的个人博客',
  author: 'Your Name',
  // ...
};
```

## 开发说明

### 添加新页面

1. 在 `src/pages/` 创建 `.astro` 文件
2. 如需英文版本，在 `src/pages/en/` 创建对应文件

### 添加新组件

- Astro 组件: `src/components/*.astro`
- React 组件: `src/components/*.tsx`

### 修改样式

- 全局样式: `src/styles/global.css`
- Tailwind 配置: `tailwind.config.mjs`

## 许可证

MIT License
