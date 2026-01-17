---
title: "使用 Docker 部署你的第一个应用"
description: "从零开始学习 Docker 容器化技术，包括镜像构建、容器运行和 Docker Compose 编排"
pubDate: 2024-01-15
category: tutorial
tags: ["Docker", "DevOps", "容器化", "部署"]
draft: false
---

Docker 已经成为现代软件开发和部署的标准工具。本文将带你从零开始，学习如何使用 Docker 容器化你的应用程序。

## 什么是 Docker？

Docker 是一个开源的容器化平台，它允许开发者将应用程序及其依赖打包到一个轻量级、可移植的容器中。与传统虚拟机相比，容器更加高效，启动速度更快。

### 容器 vs 虚拟机

| 特性 | 容器 | 虚拟机 |
|------|------|--------|
| 启动时间 | 秒级 | 分钟级 |
| 资源占用 | 低 | 高 |
| 隔离性 | 进程级 | 系统级 |
| 镜像大小 | MB 级 | GB 级 |

## 安装 Docker

### Linux (Ubuntu/Debian)

```bash
# 更新包索引
sudo apt update

# 安装必要的依赖
sudo apt install apt-transport-https ca-certificates curl gnupg lsb-release

# 添加 Docker 官方 GPG 密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 设置稳定版仓库
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io
```

### 验证安装

```bash
docker --version
docker run hello-world
```

## 编写 Dockerfile

Dockerfile 是构建 Docker 镜像的蓝图。下面是一个 Node.js 应用的示例：

```dockerfile
# 使用官方 Node.js 镜像作为基础
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "server.js"]
```

### 构建镜像

```bash
docker build -t my-app:latest .
```

### 运行容器

```bash
docker run -d -p 3000:3000 --name my-app my-app:latest
```

## 使用 Docker Compose

对于多容器应用，Docker Compose 是更好的选择：

```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=db
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=secret
      - POSTGRES_DB=myapp

volumes:
  postgres_data:
```

启动所有服务：

```bash
docker compose up -d
```

## 最佳实践

1. **使用多阶段构建** - 减小镜像体积
2. **不要以 root 用户运行** - 提高安全性
3. **使用 .dockerignore** - 排除不必要的文件
4. **固定依赖版本** - 确保可重复构建
5. **合理使用层缓存** - 加快构建速度

## 总结

Docker 简化了应用的部署和运维工作。掌握 Docker 的基本概念和命令，将大大提高你的开发效率。

下一步，你可以探索 Kubernetes 来管理大规模的容器集群。
