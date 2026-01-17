import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.API_PORT || '3001');
const BLOG_DIR = process.env.BLOG_DIR || path.join(__dirname, '..', 'src', 'content', 'blog');
const COMMENTS_FILE = process.env.COMMENTS_FILE || path.join(__dirname, 'comments.json');

// 管理员密码 (生产环境应使用环境变量)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'blog_admin_2024';

// 简单的 session 存储 (生产环境应使用 Redis 等)
const sessions = new Map<string, { expires: number }>();

function generateSessionToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function isValidSession(token: string): boolean {
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expires) {
    sessions.delete(token);
    return false;
  }
  return true;
}

// 确保评论文件存在
if (!fs.existsSync(COMMENTS_FILE)) {
  fs.writeFileSync(COMMENTS_FILE, '{}');
}

// CORS 头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 解析请求体
function parseBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// 生成 slug
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '') || 'untitled';
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  try {
    // 登录 API
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      const body = await parseBody(req);
      const { password } = JSON.parse(body);

      if (password === ADMIN_PASSWORD) {
        const token = generateSessionToken();
        sessions.set(token, { expires: Date.now() + 24 * 60 * 60 * 1000 }); // 24小时有效

        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, token }));
      } else {
        res.writeHead(401, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid password' }));
      }
      return;
    }

    // 验证 session
    if (req.method === 'POST' && url.pathname === '/api/auth/verify') {
      const body = await parseBody(req);
      const { token } = JSON.parse(body);

      if (isValidSession(token)) {
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: true }));
      } else {
        res.writeHead(401, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: false }));
      }
      return;
    }

    // 登出
    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      const body = await parseBody(req);
      const { token } = JSON.parse(body);
      sessions.delete(token);

      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // 获取博客列表
    if (req.method === 'GET' && url.pathname === '/api/posts') {
      const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));
      const posts = files.map(file => {
        const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8');
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        const frontmatter: Record<string, any> = {};

        if (match) {
          match[1].split('\n').forEach(line => {
            const [key, ...rest] = line.split(':');
            if (key && rest.length) {
              let value = rest.join(':').trim();
              // 解析数组
              if (value.startsWith('[')) {
                try {
                  value = JSON.parse(value.replace(/'/g, '"'));
                } catch {}
              }
              // 去掉引号
              if (typeof value === 'string') {
                value = value.replace(/^["']|["']$/g, '');
              }
              frontmatter[key.trim()] = value;
            }
          });
        }

        return {
          slug: file.replace('.md', ''),
          ...frontmatter,
          content: content.replace(/^---\n[\s\S]*?\n---\n*/, ''),
        };
      });

      // Sort by pubDate, newest first
      posts.sort((a, b) => {
        const dateA = new Date(a.pubDate || '1970-01-01').getTime();
        const dateB = new Date(b.pubDate || '1970-01-01').getTime();
        return dateB - dateA;
      });

      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(posts));
      return;
    }

    // 创建/更新博客
    if (req.method === 'POST' && url.pathname === '/api/posts') {
      const body = await parseBody(req);
      const { title, description, category, tags, content, slug: existingSlug } = JSON.parse(body);

      const slug = existingSlug || generateSlug(title);
      const filename = `${slug}.md`;
      const filepath = path.join(BLOG_DIR, filename);

      const markdown = `---
title: "${title}"
description: "${description}"
pubDate: ${new Date().toISOString().split('T')[0]}
category: ${category}
tags: [${(tags || []).map((t: string) => `"${t}"`).join(', ')}]
draft: false
---

${content}`;

      fs.writeFileSync(filepath, markdown);

      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, slug }));
      return;
    }

    // 获取单篇博客
    if (req.method === 'GET' && url.pathname.startsWith('/api/posts/') && !url.pathname.includes('/api/posts//')) {
      const slug = decodeURIComponent(url.pathname.replace('/api/posts/', ''));
      const filepath = path.join(BLOG_DIR, `${slug}.md`);

      if (fs.existsSync(filepath)) {
        const content = fs.readFileSync(filepath, 'utf-8');
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        const frontmatter: Record<string, any> = {};

        if (match) {
          match[1].split('\n').forEach(line => {
            const [key, ...rest] = line.split(':');
            if (key && rest.length) {
              let value = rest.join(':').trim();
              if (value.startsWith('[')) {
                try {
                  value = JSON.parse(value.replace(/'/g, '"'));
                } catch {}
              }
              if (typeof value === 'string') {
                value = value.replace(/^["']|["']$/g, '');
              }
              frontmatter[key.trim()] = value;
            }
          });
        }

        const post = {
          slug,
          ...frontmatter,
          content: content.replace(/^---\n[\s\S]*?\n---\n*/, ''),
        };

        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify(post));
      } else {
        res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Post not found' }));
      }
      return;
    }

    // 删除博客
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/posts/')) {
      const slug = decodeURIComponent(url.pathname.replace('/api/posts/', ''));
      const filepath = path.join(BLOG_DIR, `${slug}.md`);

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
      return;
    }

    // 获取评论
    if (req.method === 'GET' && url.pathname === '/api/comments') {
      const postSlug = url.searchParams.get('post');
      const comments = JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf-8'));

      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(postSlug ? (comments[postSlug] || []) : comments));
      return;
    }

    // 提交评论
    if (req.method === 'POST' && url.pathname === '/api/comments') {
      const body = await parseBody(req);
      const { postSlug, content, author, authorColor } = JSON.parse(body);

      const comments = JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf-8'));
      if (!comments[postSlug]) {
        comments[postSlug] = [];
      }

      const newComment = {
        id: Date.now(),
        author,
        authorColor,
        content,
        createdAt: new Date().toISOString(),
        postSlug,
      };

      comments[postSlug].push(newComment);
      fs.writeFileSync(COMMENTS_FILE, JSON.stringify(comments, null, 2));

      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newComment));
      return;
    }

    // 删除评论 (需要管理员权限)
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/comments/')) {
      // 验证管理员 token
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');

      console.log('[DELETE COMMENT] Request received');
      console.log('[DELETE COMMENT] Token present:', !!token);
      console.log('[DELETE COMMENT] Token valid:', token ? isValidSession(token) : false);

      if (!token || !isValidSession(token)) {
        console.log('[DELETE COMMENT] Unauthorized - rejecting');
        res.writeHead(401, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const parts = url.pathname.split('/');
      const postSlug = decodeURIComponent(parts[3]);
      const commentId = parseInt(parts[4]);

      console.log('[DELETE COMMENT] Post slug:', postSlug);
      console.log('[DELETE COMMENT] Comment ID:', commentId);

      const comments = JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf-8'));
      const originalCount = comments[postSlug]?.length || 0;

      if (comments[postSlug]) {
        comments[postSlug] = comments[postSlug].filter((c: any) => c.id !== commentId);
        fs.writeFileSync(COMMENTS_FILE, JSON.stringify(comments, null, 2));
        console.log('[DELETE COMMENT] Deleted. Before:', originalCount, 'After:', comments[postSlug].length);
      } else {
        console.log('[DELETE COMMENT] Post slug not found in comments');
      }

      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // 404
    res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));

  } catch (error) {
    console.error(error);
    res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`Blog API server running at http://localhost:${PORT}`);
  console.log(`Blog files: ${BLOG_DIR}`);
});
