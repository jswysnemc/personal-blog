import { useState, useEffect } from 'react';
import { fetchPosts, createPost, deletePost, type Post } from '../lib/api';
import { isAdminLoggedIn } from '../lib/auth';
import { ui, type Lang } from '../lib/i18n';

interface Props {
  lang?: Lang;
}

const categories = ['tech', 'life', 'thoughts', 'tutorial', 'reading'] as const;

const categoryColors: Record<string, { bg: string; text: string; dot: string }> = {
  tech: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  life: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  thoughts: { bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  tutorial: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  reading: { bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
};

export default function BlogEditor({ lang = 'zh' }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [editingPost, setEditingPost] = useState<Partial<Post> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const t = (key: keyof typeof ui.zh) => ui[lang][key] || ui.zh[key];

  useEffect(() => {
    setIsAdmin(isAdminLoggedIn());
    loadPosts();
  }, []);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  async function loadPosts() {
    try {
      const data = await fetchPosts();
      setPosts(data);
    } catch {
      setError('Failed to load posts. Make sure the server is running.');
    }
  }

  async function handleSave() {
    if (!editingPost?.title || !editingPost?.content) {
      setError(lang === 'zh' ? '标题和内容不能为空' : 'Title and content are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createPost({
        title: editingPost.title,
        description: editingPost.description || '',
        category: editingPost.category || 'tech',
        tags: editingPost.tags || [],
        content: editingPost.content,
      });

      setSuccess(lang === 'zh' ? '文章已保存！' : 'Post saved successfully!');
      setView('list');
      setEditingPost(null);
      loadPosts();
    } catch {
      setError(lang === 'zh' ? '保存失败，请确保服务器正在运行' : 'Failed to save. Make sure the server is running.');
    }

    setLoading(false);
  }

  async function handleDelete(slug: string) {
    if (!confirm(lang === 'zh' ? '确定要删除这篇文章吗？此操作不可撤销。' : 'Are you sure you want to delete this post? This cannot be undone.')) {
      return;
    }

    try {
      await deletePost(slug);
      loadPosts();
      setSuccess(lang === 'zh' ? '文章已删除' : 'Post deleted');
    } catch {
      setError(lang === 'zh' ? '删除失败' : 'Failed to delete');
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            {lang === 'zh' ? '请先登录管理员账户' : 'Please login as admin first'}
          </p>
        </div>
      </div>
    );
  }

  // Edit View
  if (view === 'edit') {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Editor Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setView('list'); setEditingPost(null); setError(''); }}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {editingPost?.slug
                    ? (lang === 'zh' ? '编辑文章' : 'Edit Post')
                    : (lang === 'zh' ? '新建文章' : 'New Post')}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'zh' ? '使用 Markdown 格式编写内容' : 'Write content in Markdown format'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => { setView('list'); setEditingPost(null); setError(''); }}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {lang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium rounded-lg
                           hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 dark:border-slate-900/30 border-t-white dark:border-t-slate-900 rounded-full animate-spin" />
                    {lang === 'zh' ? '保存中...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M5 13l4 4L19 7" />
                    </svg>
                    {lang === 'zh' ? '保存文章' : 'Save Post'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Editor Content */}
        <div className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-xl animate-fade-in">
              <svg className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {lang === 'zh' ? '文章标题' : 'Title'}
            </label>
            <input
              type="text"
              value={editingPost?.title || ''}
              onChange={e => setEditingPost(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-3 text-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl
                         focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800
                         transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white"
              placeholder={lang === 'zh' ? '输入一个吸引人的标题...' : 'Enter an engaging title...'}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {lang === 'zh' ? '文章描述' : 'Description'}
            </label>
            <textarea
              value={editingPost?.description || ''}
              onChange={e => setEditingPost(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl resize-none
                         focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800
                         transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white"
              rows={2}
              placeholder={lang === 'zh' ? '简短描述文章内容，将显示在列表页...' : 'Brief description of the post...'}
            />
          </div>

          {/* Category & Tags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {lang === 'zh' ? '分类' : 'Category'}
              </label>
              <div className="relative">
                <select
                  value={editingPost?.category || 'tech'}
                  onChange={e => setEditingPost(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl appearance-none
                             focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800
                             transition-all cursor-pointer text-slate-900 dark:text-white"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{t(`category.${cat}` as keyof typeof ui.zh)}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {lang === 'zh' ? '标签' : 'Tags'}
                <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
                  ({lang === 'zh' ? '逗号分隔' : 'comma separated'})
                </span>
              </label>
              <input
                type="text"
                value={(editingPost?.tags || []).join(', ')}
                onChange={e => setEditingPost(prev => ({
                  ...prev,
                  tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                }))}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl
                           focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800
                           transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white"
                placeholder="react, typescript, tutorial"
              />
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {lang === 'zh' ? '文章内容' : 'Content'}
              <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">(Markdown)</span>
            </label>
            <textarea
              value={editingPost?.content || ''}
              onChange={e => setEditingPost(prev => ({ ...prev, content: e.target.value }))}
              className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl
                         focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800
                         transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono text-sm leading-relaxed text-slate-900 dark:text-white"
              rows={20}
              placeholder={lang === 'zh'
                ? '# 标题\n\n正文内容...\n\n## 子标题\n\n- 列表项\n- 列表项\n\n```javascript\nconst code = "示例代码";\n```'
                : '# Heading\n\nParagraph text...\n\n## Subheading\n\n- List item\n- List item\n\n```javascript\nconst code = "example";\n```'}
            />
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {lang === 'zh' ? '文章管理' : 'Post Management'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'zh'
              ? `共 ${posts.length} 篇文章`
              : `${posts.length} post${posts.length !== 1 ? 's' : ''} total`}
          </p>
        </div>
        <button
          onClick={() => { setEditingPost({}); setView('edit'); setError(''); setSuccess(''); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-medium rounded-xl
                     hover:bg-slate-800 dark:hover:bg-white transition-colors shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {lang === 'zh' ? '新建文章' : 'New Post'}
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-xl animate-fade-in">
          <svg className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 rounded-xl animate-fade-in">
          <svg className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-emerald-700 dark:text-emerald-400 text-sm">{success}</p>
        </div>
      )}

      {/* Posts List */}
      {posts.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <svg className="w-10 h-10 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            {lang === 'zh' ? '暂无文章' : 'No posts yet'}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            {lang === 'zh' ? '点击上方按钮创建你的第一篇文章' : 'Click the button above to create your first post'}
          </p>
          <button
            onClick={() => { setEditingPost({}); setView('edit'); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-medium rounded-xl
                       hover:bg-slate-800 dark:hover:bg-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {lang === 'zh' ? '创建文章' : 'Create Post'}
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {posts.map((post, index) => {
              const catColor = categoryColors[post.category] || categoryColors.tech;
              return (
                <div
                  key={post.slug}
                  className="p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate">
                          {post.title}
                        </h3>
                        {post.draft && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-full">
                            {lang === 'zh' ? '草稿' : 'Draft'}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${catColor.bg} ${catColor.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${catColor.dot}`} />
                          {t(`category.${post.category}` as keyof typeof ui.zh)}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500">|</span>
                        <span className="text-slate-500 dark:text-slate-400">{post.pubDate}</span>
                        {post.tags && post.tags.length > 0 && (
                          <>
                            <span className="text-slate-400 dark:text-slate-500">|</span>
                            <span className="text-slate-400 dark:text-slate-500">
                              {post.tags.slice(0, 3).map(tag => `#${tag}`).join(' ')}
                              {post.tags.length > 3 && ` +${post.tags.length - 3}`}
                            </span>
                          </>
                        )}
                      </div>

                      {post.description && (
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                          {post.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { setEditingPost(post); setView('edit'); setError(''); setSuccess(''); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white
                                   bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        {lang === 'zh' ? '编辑' : 'Edit'}
                      </button>
                      <button
                        onClick={() => handleDelete(post.slug)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300
                                   bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {lang === 'zh' ? '删除' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
