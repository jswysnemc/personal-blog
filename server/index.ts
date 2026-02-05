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

// AI API Token (用于自动化创建博客)
const AI_API_TOKEN = process.env.AI_API_TOKEN || 'ai_blog_token_2024';

// 简单的 session 存储 (生产环境应使用 Redis 等)
const sessions = new Map<string, { expires: number }>();

// 有效的分类列表
const VALID_CATEGORIES = ['tech', 'life', 'thoughts', 'tutorial', 'reading'];

// 验证博客元数据的函数
interface ValidationError {
  field: string;
  message: string;
  suggestion?: string;
}

interface BlogPostInput {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  content?: string;
  draft?: boolean | string;
  slug?: string;
  pubDate?: string;
}

function validateBlogPost(data: BlogPostInput): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  // 验证标题
  if (!data.title) {
    errors.push({
      field: 'title',
      message: 'Title is required',
      suggestion: 'Provide a descriptive title for the blog post, e.g., "Getting Started with TypeScript"'
    });
  } else if (typeof data.title !== 'string') {
    errors.push({
      field: 'title',
      message: 'Title must be a string',
      suggestion: 'Provide title as a plain text string'
    });
  } else if (data.title.length < 5) {
    errors.push({
      field: 'title',
      message: 'Title is too short (minimum 5 characters)',
      suggestion: 'Provide a more descriptive title'
    });
  } else if (data.title.length > 200) {
    errors.push({
      field: 'title',
      message: 'Title is too long (maximum 200 characters)',
      suggestion: 'Shorten the title to be more concise'
    });
  }

  // 验证描述
  if (!data.description) {
    errors.push({
      field: 'description',
      message: 'Description is required',
      suggestion: 'Provide a brief summary of the blog post (50-200 characters recommended)'
    });
  } else if (typeof data.description !== 'string') {
    errors.push({
      field: 'description',
      message: 'Description must be a string',
      suggestion: 'Provide description as a plain text string'
    });
  } else if (data.description.length < 10) {
    errors.push({
      field: 'description',
      message: 'Description is too short (minimum 10 characters)',
      suggestion: 'Provide a more detailed description that summarizes the post content'
    });
  } else if (data.description.length > 500) {
    errors.push({
      field: 'description',
      message: 'Description is too long (maximum 500 characters)',
      suggestion: 'Shorten the description to be a brief summary'
    });
  }

  // 验证分类
  if (!data.category) {
    errors.push({
      field: 'category',
      message: 'Category is required',
      suggestion: `Choose one of the valid categories: ${VALID_CATEGORIES.join(', ')}`
    });
  } else if (!VALID_CATEGORIES.includes(data.category)) {
    errors.push({
      field: 'category',
      message: `Invalid category: "${data.category}"`,
      suggestion: `Valid categories are: ${VALID_CATEGORIES.join(', ')}. "tech" for technical articles, "tutorial" for how-to guides, "life" for personal stories, "thoughts" for opinions, "reading" for book reviews`
    });
  }

  // 验证标签
  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags)) {
      errors.push({
        field: 'tags',
        message: 'Tags must be an array of strings',
        suggestion: 'Provide tags as an array, e.g., ["javascript", "react", "frontend"]'
      });
    } else {
      const invalidTags = data.tags.filter(t => typeof t !== 'string' || t.length === 0);
      if (invalidTags.length > 0) {
        errors.push({
          field: 'tags',
          message: 'All tags must be non-empty strings',
          suggestion: 'Remove empty tags and ensure all tags are strings'
        });
      }
      if (data.tags.length > 10) {
        errors.push({
          field: 'tags',
          message: 'Too many tags (maximum 10)',
          suggestion: 'Reduce the number of tags to the most relevant ones'
        });
      }
    }
  }

  // 验证内容
  if (!data.content) {
    errors.push({
      field: 'content',
      message: 'Content is required',
      suggestion: 'Provide the blog post content in Markdown format'
    });
  } else if (typeof data.content !== 'string') {
    errors.push({
      field: 'content',
      message: 'Content must be a string',
      suggestion: 'Provide content as a Markdown-formatted string'
    });
  } else if (data.content.length < 100) {
    errors.push({
      field: 'content',
      message: 'Content is too short (minimum 100 characters)',
      suggestion: 'Provide more substantial content for the blog post'
    });
  }

  // 验证 draft 字段
  if (data.draft !== undefined && typeof data.draft !== 'boolean' && data.draft !== 'true' && data.draft !== 'false') {
    errors.push({
      field: 'draft',
      message: 'Draft must be a boolean (true/false)',
      suggestion: 'Set draft to true to save as draft, or false to publish immediately'
    });
  }

  // 验证 pubDate 格式
  if (data.pubDate) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.pubDate)) {
      errors.push({
        field: 'pubDate',
        message: 'Invalid date format',
        suggestion: 'Use YYYY-MM-DD format, e.g., "2024-01-15"'
      });
    } else {
      const date = new Date(data.pubDate);
      if (isNaN(date.getTime())) {
        errors.push({
          field: 'pubDate',
          message: 'Invalid date value',
          suggestion: 'Provide a valid date in YYYY-MM-DD format'
        });
      }
    }
  }

  // 验证 slug 格式
  if (data.slug) {
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(data.slug)) {
      errors.push({
        field: 'slug',
        message: 'Invalid slug format',
        suggestion: 'Slug should be lowercase letters, numbers, and hyphens only, e.g., "my-blog-post"'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// 验证 AI API Token
function isValidAIToken(token: string | undefined): boolean {
  return token === AI_API_TOKEN;
}

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

    // ==================== AI API 端点 ====================

    // AI API: 获取 API 信息和使用说明
    if (req.method === 'GET' && url.pathname === '/api/ai/info') {
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        name: 'Blog AI API',
        version: '1.0.0',
        description: 'API for AI agents to create and manage blog posts',
        authentication: {
          type: 'Bearer Token',
          header: 'Authorization: Bearer <AI_API_TOKEN>',
          note: 'Set AI_API_TOKEN environment variable on server'
        },
        endpoints: {
          'POST /api/ai/posts': {
            description: 'Create a new blog post',
            authentication: 'Required',
            body: {
              title: { type: 'string', required: true, minLength: 5, maxLength: 200, description: 'Blog post title' },
              description: { type: 'string', required: true, minLength: 10, maxLength: 500, description: 'Brief summary of the post' },
              category: { type: 'string', required: true, enum: VALID_CATEGORIES, description: 'Post category' },
              tags: { type: 'array', required: false, maxItems: 10, description: 'Array of tag strings' },
              content: { type: 'string', required: true, minLength: 100, description: 'Markdown content of the post' },
              draft: { type: 'boolean', required: false, default: false, description: 'Save as draft if true' },
              slug: { type: 'string', required: false, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', description: 'URL slug (auto-generated if not provided)' },
              pubDate: { type: 'string', required: false, format: 'YYYY-MM-DD', description: 'Publication date (defaults to today)' }
            },
            responses: {
              200: { description: 'Post created successfully', example: { success: true, slug: 'my-blog-post', url: '/blog/my-blog-post' } },
              400: { description: 'Validation errors', example: { success: false, errors: [{ field: 'title', message: 'Title is required', suggestion: '...' }] } },
              401: { description: 'Invalid or missing API token' }
            }
          },
          'POST /api/ai/posts/validate': {
            description: 'Validate blog post data without creating',
            authentication: 'Required',
            body: 'Same as POST /api/ai/posts',
            responses: {
              200: { description: 'Validation result', example: { valid: true, errors: [] } }
            }
          },
          'GET /api/ai/posts': {
            description: 'List all blog posts',
            authentication: 'Required',
            query: {
              category: { type: 'string', required: false, description: 'Filter by category' },
              draft: { type: 'boolean', required: false, description: 'Filter by draft status' },
              limit: { type: 'number', required: false, default: 50, description: 'Maximum posts to return' }
            }
          },
          'GET /api/ai/categories': {
            description: 'Get list of valid categories',
            authentication: 'Not required'
          }
        },
        categories: VALID_CATEGORIES.map(cat => ({
          value: cat,
          description: cat === 'tech' ? 'Technical articles about programming, software, etc.'
            : cat === 'tutorial' ? 'Step-by-step how-to guides'
            : cat === 'life' ? 'Personal stories and experiences'
            : cat === 'thoughts' ? 'Opinions, reflections, and ideas'
            : cat === 'reading' ? 'Book reviews and reading notes'
            : cat
        }))
      }));
      return;
    }

    // AI API: 获取有效分类列表
    if (req.method === 'GET' && url.pathname === '/api/ai/categories') {
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        categories: VALID_CATEGORIES,
        descriptions: {
          tech: 'Technical articles about programming, software, frameworks, etc.',
          tutorial: 'Step-by-step how-to guides and tutorials',
          life: 'Personal stories, experiences, and lifestyle content',
          thoughts: 'Opinions, reflections, philosophical ideas',
          reading: 'Book reviews, reading notes, and literary discussions'
        }
      }));
      return;
    }

    // AI API: 验证博客数据（不创建）
    if (req.method === 'POST' && url.pathname === '/api/ai/posts/validate') {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');

      if (!isValidAIToken(token)) {
        res.writeHead(401, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Invalid or missing API token',
          hint: 'Include Authorization header: Bearer <AI_API_TOKEN>'
        }));
        return;
      }

      const body = await parseBody(req);
      let data: BlogPostInput;
      try {
        data = JSON.parse(body);
      } catch {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body',
          hint: 'Ensure the request body is valid JSON'
        }));
        return;
      }

      const validation = validateBlogPost(data);
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        valid: validation.valid,
        errors: validation.errors,
        ...(validation.valid ? {
          preview: {
            slug: data.slug || generateSlug(data.title || ''),
            title: data.title,
            description: data.description,
            category: data.category,
            tags: data.tags || [],
            draft: data.draft === true || data.draft === 'true',
            pubDate: data.pubDate || new Date().toISOString().split('T')[0]
          }
        } : {})
      }));
      return;
    }

    // AI API: 创建博客文章
    if (req.method === 'POST' && url.pathname === '/api/ai/posts') {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');

      if (!isValidAIToken(token)) {
        res.writeHead(401, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Invalid or missing API token',
          hint: 'Include Authorization header: Bearer <AI_API_TOKEN>'
        }));
        return;
      }

      const body = await parseBody(req);
      let data: BlogPostInput;
      try {
        data = JSON.parse(body);
      } catch {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body',
          hint: 'Ensure the request body is valid JSON'
        }));
        return;
      }

      // 验证数据
      const validation = validateBlogPost(data);
      if (!validation.valid) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Validation failed',
          errors: validation.errors,
          hint: 'Fix the errors above and retry. Use POST /api/ai/posts/validate to test without creating.'
        }));
        return;
      }

      // 生成 slug
      const slug = data.slug || generateSlug(data.title!);
      const filename = `${slug}.md`;
      const filepath = path.join(BLOG_DIR, filename);

      // 检查是否已存在
      if (fs.existsSync(filepath) && !data.slug) {
        // 如果没有指定 slug 且自动生成的已存在，添加时间戳
        const uniqueSlug = `${slug}-${Date.now()}`;
        const uniqueFilepath = path.join(BLOG_DIR, `${uniqueSlug}.md`);

        const pubDate = data.pubDate || new Date().toISOString().split('T')[0];
        const markdown = `---
title: "${data.title}"
description: "${data.description}"
pubDate: ${pubDate}
category: ${data.category}
tags: [${(data.tags || []).map((t: string) => `"${t}"`).join(', ')}]
draft: ${data.draft === true || data.draft === 'true' ? 'true' : 'false'}
---

${data.content}`;

        fs.writeFileSync(uniqueFilepath, markdown);

        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          slug: uniqueSlug,
          url: `/blog/${uniqueSlug}`,
          message: 'Blog post created successfully',
          note: `Original slug "${slug}" was taken, used "${uniqueSlug}" instead`
        }));
        return;
      }

      const pubDate = data.pubDate || new Date().toISOString().split('T')[0];
      const markdown = `---
title: "${data.title}"
description: "${data.description}"
pubDate: ${pubDate}
category: ${data.category}
tags: [${(data.tags || []).map((t: string) => `"${t}"`).join(', ')}]
draft: ${data.draft === true || data.draft === 'true' ? 'true' : 'false'}
---

${data.content}`;

      fs.writeFileSync(filepath, markdown);

      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        slug,
        url: `/blog/${slug}`,
        message: 'Blog post created successfully',
        post: {
          title: data.title,
          description: data.description,
          category: data.category,
          tags: data.tags || [],
          draft: data.draft === true || data.draft === 'true',
          pubDate
        }
      }));
      return;
    }

    // AI API: 获取博客列表（带过滤）
    if (req.method === 'GET' && url.pathname === '/api/ai/posts') {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');

      if (!isValidAIToken(token)) {
        res.writeHead(401, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Invalid or missing API token',
          hint: 'Include Authorization header: Bearer <AI_API_TOKEN>'
        }));
        return;
      }

      const categoryFilter = url.searchParams.get('category');
      const draftFilter = url.searchParams.get('draft');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));
      let posts = files.map(file => {
        const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8');
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        const frontmatter: Record<string, any> = {};

        if (match) {
          match[1].split('\n').forEach(line => {
            const [key, ...rest] = line.split(':');
            if (key && rest.length) {
              let value: any = rest.join(':').trim();
              if (value.startsWith('[')) {
                try {
                  value = JSON.parse(value.replace(/'/g, '"'));
                } catch {}
              }
              if (typeof value === 'string') {
                value = value.replace(/^["']|["']$/g, '');
              }
              if (value === 'true') value = true;
              if (value === 'false') value = false;
              frontmatter[key.trim()] = value;
            }
          });
        }

        return {
          slug: file.replace('.md', ''),
          ...frontmatter,
          contentLength: content.replace(/^---\n[\s\S]*?\n---\n*/, '').length,
        };
      });

      // 应用过滤
      if (categoryFilter) {
        posts = posts.filter(p => p.category === categoryFilter);
      }
      if (draftFilter !== null) {
        const isDraft = draftFilter === 'true';
        posts = posts.filter(p => p.draft === isDraft);
      }

      // 排序
      posts.sort((a, b) => {
        const dateA = new Date(a.pubDate || '1970-01-01').getTime();
        const dateB = new Date(b.pubDate || '1970-01-01').getTime();
        return dateB - dateA;
      });

      // 限制数量
      posts = posts.slice(0, limit);

      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        count: posts.length,
        posts
      }));
      return;
    }

    // ==================== 原有 API 端点 ====================

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
              // 解析布尔值
              if (value === 'true') value = true;
              if (value === 'false') value = false;
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
      const { title, description, category, tags, content, slug: existingSlug, draft } = JSON.parse(body);

      const slug = existingSlug || generateSlug(title);
      const filename = `${slug}.md`;
      const filepath = path.join(BLOG_DIR, filename);

      const markdown = `---
title: "${title}"
description: "${description}"
pubDate: ${new Date().toISOString().split('T')[0]}
category: ${category}
tags: [${(tags || []).map((t: string) => `"${t}"`).join(', ')}]
draft: ${draft === true || draft === 'true' ? 'true' : 'false'}
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
              // 解析布尔值
              if (value === 'true') value = true;
              if (value === 'false') value = false;
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
      const { postSlug, content, author, authorColor, isAuthor } = JSON.parse(body);

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
        isAuthor: isAuthor || false,
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
