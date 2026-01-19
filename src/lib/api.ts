// Use relative URLs - works both in browser and through Astro proxy
const API_BASE = typeof window !== 'undefined' ? '' : (process.env.API_INTERNAL_URL || 'http://localhost:3001');

export interface Post {
  slug: string;
  title: string;
  description: string;
  pubDate: string;
  category: string;
  tags: string[];
  content: string;
  draft?: boolean | string;
}

export interface Comment {
  id: number;
  author: string;
  authorColor: string;
  content: string;
  createdAt: string;
  postSlug: string;
  isAuthor?: boolean;
}

// 博客文章 API
export async function fetchPosts(): Promise<Post[]> {
  const res = await fetch(`${API_BASE}/api/posts`);
  if (!res.ok) throw new Error('Failed to fetch posts');
  return res.json();
}

export async function createPost(post: Omit<Post, 'slug' | 'pubDate'>): Promise<{ slug: string }> {
  const res = await fetch(`${API_BASE}/api/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(post),
  });
  if (!res.ok) throw new Error('Failed to create post');
  return res.json();
}

export async function updatePost(slug: string, post: Omit<Post, 'slug' | 'pubDate'>): Promise<{ slug: string }> {
  const res = await fetch(`${API_BASE}/api/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...post, slug }),
  });
  if (!res.ok) throw new Error('Failed to update post');
  return res.json();
}

export async function fetchPost(slug: string): Promise<Post> {
  const res = await fetch(`${API_BASE}/api/posts/${slug}`);
  if (!res.ok) throw new Error('Failed to fetch post');
  return res.json();
}

export async function deletePost(slug: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/posts/${slug}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete post');
}

// 评论 API
export async function fetchComments(postSlug: string): Promise<Comment[]> {
  const res = await fetch(`${API_BASE}/api/comments?post=${encodeURIComponent(postSlug)}`);
  if (!res.ok) throw new Error('Failed to fetch comments');
  return res.json();
}

export async function submitComment(
  postSlug: string,
  content: string,
  author: string,
  authorColor: string,
  isAuthor?: boolean
): Promise<Comment> {
  const res = await fetch(`${API_BASE}/api/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postSlug, content, author, authorColor, isAuthor }),
  });
  if (!res.ok) throw new Error('Failed to submit comment');
  return res.json();
}

export async function deleteComment(postSlug: string, commentId: number, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/comments/${encodeURIComponent(postSlug)}/${commentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Unauthorized');
    }
    throw new Error('Failed to delete comment');
  }
}
