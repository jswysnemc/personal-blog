import { useState, useEffect } from 'react';
import { fetchPosts, createPost, updatePost, deletePost, type Post } from '../lib/api';
import { isAdminLoggedIn } from '../lib/auth';
import { ui, type Lang } from '../lib/i18n';
import { MarkdownEditor, type EditorMode } from './editor';
import ArticlesHeader from './ArticlesHeader';

interface Props {
  lang?: Lang;
  initialPost?: Partial<Post> | null;
  onBack?: () => void;
  fullscreenMode?: boolean;
}

const DEFAULT_CATEGORIES = ['tech', 'life', 'thoughts', 'tutorial', 'reading'] as const;

const categoryColors: Record<string, { bg: string; text: string; dot: string }> = {
  tech: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  life: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  thoughts: { bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  tutorial: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  reading: { bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
};

export default function BlogEditor({ lang = 'zh', initialPost, onBack, fullscreenMode = false }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<'list' | 'edit' | 'categories'>(initialPost ? 'edit' : 'list');
  const [editingPost, setEditingPost] = useState<Partial<Post> | null>(initialPost || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editorMode, setEditorMode] = useState<EditorMode>('source');
  const [categories, setCategories] = useState<string[]>([...DEFAULT_CATEGORIES]);
  const [newCategory, setNewCategory] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const t = (key: keyof typeof ui.zh) => ui[lang][key] || ui.zh[key];
  const isDraft = (draft?: boolean | string) => draft === true || draft === 'true';


  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view !== 'edit') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }

      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, isFullscreen]);

  useEffect(() => {
    setIsAdmin(isAdminLoggedIn());
    loadPosts();
    loadCategories();
  }, []);

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

  function loadCategories() {
    const stored = localStorage.getItem('blog_categories');
    if (stored) {
      try {
        setCategories(JSON.parse(stored));
      } catch {
        setCategories([...DEFAULT_CATEGORIES]);
      }
    }
  }

  function saveCategories(cats: string[]) {
    setCategories(cats);
    localStorage.setItem('blog_categories', JSON.stringify(cats));
  }

  function handleAddCategory() {
    const cat = newCategory.trim().toLowerCase();
    if (!cat) {
      setError(lang === 'zh' ? '分类名称不能为空' : 'Category name cannot be empty');
      return;
    }
    if (categories.includes(cat)) {
      setError(lang === 'zh' ? '该分类已存在' : 'Category already exists');
      return;
    }
    saveCategories([...categories, cat]);
    setNewCategory('');
    setSuccess(lang === 'zh' ? '分类已添加' : 'Category added');
  }

  function handleDeleteCategory(cat: string) {
    if (DEFAULT_CATEGORIES.includes(cat as any)) {
      setError(lang === 'zh' ? '无法删除默认分类' : 'Cannot delete default category');
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: lang === 'zh' ? '删除分类' : 'Delete Category',
      message: lang === 'zh' ? `确定要删除分类"${cat}"吗？` : `Delete category "${cat}"?`,
      onConfirm: () => {
        setConfirmDialog(null);
        saveCategories(categories.filter(c => c !== cat));
        setSuccess(lang === 'zh' ? '分类已删除' : 'Category deleted');
      }
    });
  }

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
      // If editing existing post, pass slug to update it
      if (editingPost.slug) {
        await updatePost(editingPost.slug, {
          title: editingPost.title,
          description: editingPost.description || '',
          category: editingPost.category || 'tech',
          tags: editingPost.tags || [],
          content: editingPost.content,
          draft: isDraft(editingPost.draft),
        });
      } else {
        // Creating new post
        await createPost({
          title: editingPost.title,
          description: editingPost.description || '',
          category: editingPost.category || 'tech',
          tags: editingPost.tags || [],
          content: editingPost.content,
          draft: isDraft(editingPost.draft),
        });
      }

      setSuccess(lang === 'zh' ? '文章已保存!' : 'Post saved successfully!');
      if (fullscreenMode && onBack) {
        onBack();
      } else {
        setView('list');
        setEditingPost(null);
        loadPosts();
      }
    } catch {
      setError(lang === 'zh' ? '保存失败,请确保服务器正在运行' : 'Failed to save. Make sure the server is running.');
    }

    setLoading(false);
  }

  async function handleDelete(slug: string) {
    setConfirmDialog({
      isOpen: true,
      title: lang === 'zh' ? '删除文章' : 'Delete Post',
      message: lang === 'zh' ? '确定要删除这篇文章吗？此操作不可撤销。' : 'Are you sure you want to delete this post? This cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deletePost(slug);
          loadPosts();
          setSuccess(lang === 'zh' ? '文章已删除' : 'Post deleted');
        } catch {
          setError(lang === 'zh' ? '删除失败' : 'Failed to delete');
        }
      }
    });
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

  // Category Management View
  if (view === 'categories') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {lang === 'zh' ? '分类管理' : 'Category Management'}
          </h2>
          <button
            onClick={() => setView('list')}
            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            {lang === 'zh' ? '返回' : 'Back'}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-xl">
            <svg className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 rounded-xl">
            <svg className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-emerald-700 dark:text-emerald-400 text-sm">{success}</p>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            {lang === 'zh' ? '添加新分类' : 'Add New Category'}
          </h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
              className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg
                         focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500
                         transition-all text-slate-900 dark:text-white"
              placeholder={lang === 'zh' ? '输入分类名称（英文小写）' : 'Enter category name (lowercase)'}
            />
            <button
              onClick={handleAddCategory}
              className="px-6 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors"
            >
              {lang === 'zh' ? '添加' : 'Add'}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {lang === 'zh' ? '现有分类' : 'Existing Categories'}
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {categories.map(cat => {
              const isDefault = DEFAULT_CATEGORIES.includes(cat as any);
              const catColor = categoryColors[cat] || categoryColors.tech;
              return (
                <div key={cat} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${catColor.bg} ${catColor.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${catColor.dot}`} />
                      {(() => {
                        const translationKey = `category.${cat}` as keyof typeof ui.zh;
                        return ui[lang][translationKey] || ui.zh[translationKey] || cat;
                      })()}
                    </span>
                    {isDefault && (
                      <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
                        {lang === 'zh' ? '默认' : 'Default'}
                      </span>
                    )}
                  </div>
                  {!isDefault && (
                    <button
                      onClick={() => handleDeleteCategory(cat)}
                      className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      {lang === 'zh' ? '删除' : 'Delete'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Edit View
  if (view === 'edit') {
    const containerClass = (isFullscreen || fullscreenMode)
      ? 'fixed inset-0 z-50 bg-white dark:bg-slate-900'
      : 'bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 border border-slate-200 dark:border-slate-700';

    const handleBackClick = () => {
      if (fullscreenMode && onBack) {
        onBack();
      } else {
        setView('list');
        setEditingPost(null);
        setError('');
        setIsFullscreen(false);
      }
    };

    return (
      <div className={`${containerClass} overflow-hidden flex flex-col`}>
        {/* Editor Header */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackClick}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title={lang === 'zh' ? '返回' : 'Back'}
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
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title={isFullscreen ? (lang === 'zh' ? '退出全屏' : 'Exit fullscreen') : (lang === 'zh' ? '全屏编辑' : 'Fullscreen')}
              >
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isFullscreen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  )}
                </svg>
              </button>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
              <button
                onClick={handleBackClick}
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
        <div className="flex-1 overflow-auto">
          <div className="p-6 space-y-6 max-w-7xl mx-auto">
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

            {/* Title & Description - Compact Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  {lang === 'zh' ? '标题' : 'Title'}
                </label>
                <input
                  type="text"
                  value={editingPost?.title || ''}
                  onChange={e => setEditingPost(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 text-base bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg
                             focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800
                             transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white"
                  placeholder={lang === 'zh' ? '输入标题...' : 'Enter title...'}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  {lang === 'zh' ? '分类' : 'Category'}
                </label>
                <div className="relative">
                  <select
                    value={editingPost?.category || 'tech'}
                    onChange={e => setEditingPost(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg appearance-none
                               focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800
                               transition-all cursor-pointer text-slate-900 dark:text-white"
                  >
                    {categories.map(cat => {
                      const translationKey = `category.${cat}` as keyof typeof ui.zh;
                      const displayName = ui[lang][translationKey] || ui.zh[translationKey] || cat;
                      return <option key={cat} value={cat}>{displayName}</option>;
                    })}
                  </select>
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Description & Tags - Compact Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  {lang === 'zh' ? '描述' : 'Description'}
                </label>
                <input
                  type="text"
                  value={editingPost?.description || ''}
                  onChange={e => setEditingPost(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg
                             focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800
                             transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white"
                  placeholder={lang === 'zh' ? '简短描述...' : 'Brief description...'}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  {lang === 'zh' ? '标签' : 'Tags'}
                  <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
                    (Enter {lang === 'zh' ? '添加' : 'to add'})
                  </span>
                </label>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 dark:focus-within:border-blue-500 focus-within:bg-white dark:focus-within:bg-slate-800 transition-all">
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {(editingPost?.tags || []).map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs rounded"
                      >
                        {tag}
                        <button
                          onClick={() => setEditingPost(prev => ({
                            ...prev,
                            tags: (prev?.tags || []).filter((_, i) => i !== idx)
                          }))}
                          className="hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                          e.preventDefault();
                          const newTag = e.currentTarget.value.trim();
                          setEditingPost(prev => ({
                            ...prev,
                            tags: [...(prev?.tags || []), newTag]
                          }));
                          e.currentTarget.value = '';
                        }
                      }}
                      className="flex-1 min-w-[80px] py-0.5 bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white text-sm"
                      placeholder={editingPost?.tags?.length ? '' : (lang === 'zh' ? '输入标签...' : 'Add tag...')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Draft Toggle - Inline Compact */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditingPost(prev => ({
                  ...prev,
                  draft: !isDraft(prev?.draft)
                }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  isDraft(editingPost?.draft)
                    ? 'bg-amber-500 dark:bg-amber-500'
                    : 'bg-emerald-500 dark:bg-emerald-500'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    isDraft(editingPost?.draft) ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                  style={{ transform: isDraft(editingPost?.draft) ? 'translateX(18px)' : 'translateX(4px)' }}
                />
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {isDraft(editingPost?.draft)
                  ? (lang === 'zh' ? '草稿 (不公开)' : 'Draft (hidden)')
                  : (lang === 'zh' ? '已发布' : 'Published')}
              </span>
            </div>

            {/* Content Editor */}
            <MarkdownEditor
              value={editingPost?.content || ''}
              onChange={(content) => setEditingPost(prev => ({ ...prev, content }))}
              mode={editorMode}
              onModeChange={setEditorMode}
              lang={lang}
              minHeight={isFullscreen || fullscreenMode ? '70vh' : '600px'}
            />
          </div>
        </div>
      </div>
    );
  }

  // Filter posts based on search and filters
  const filteredPosts = posts.filter(post => {
    const matchesSearch = searchQuery === '' ||
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || post.category === selectedCategory;

    const matchesStatus = selectedStatus === 'all' ||
      (selectedStatus === 'draft' && isDraft(post.draft)) ||
      (selectedStatus === 'published' && !isDraft(post.draft));

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // List View
  return (
    <div className="space-y-6">
      {/* Header with Search and Filters - Sticky below admin header */}
      <div className="sticky top-36 z-30 bg-slate-50 dark:bg-slate-900 -mx-6 px-6 py-4 -mt-8">
        <ArticlesHeader
          lang={lang}
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
          selectedStatus={selectedStatus}
          categories={categories}
          onSearchChange={setSearchQuery}
          onCategoryChange={setSelectedCategory}
          onStatusChange={setSelectedStatus}
          onNewPost={() => { setEditingPost({ draft: false }); setView('edit'); setError(''); setSuccess(''); }}
          onManageCategories={() => setView('categories')}
          totalPosts={posts.length}
        />
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

      {/* Posts Grid */}
      {filteredPosts.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <svg className="w-10 h-10 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            {searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all'
              ? (lang === 'zh' ? '未找到匹配的文章' : 'No matching articles found')
              : (lang === 'zh' ? '暂无文章' : 'No posts yet')}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            {searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all'
              ? (lang === 'zh' ? '尝试调整搜索条件或筛选器' : 'Try adjusting your search or filters')
              : (lang === 'zh' ? '点击上方按钮创建你的第一篇文章' : 'Click the button above to create your first post')}
          </p>
          {!searchQuery && selectedCategory === 'all' && selectedStatus === 'all' && (
            <button
              onClick={() => { setEditingPost({ draft: false }); setView('edit'); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {lang === 'zh' ? '创建文章' : 'Create Post'}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <div className="divide-y divide-slate-100 dark:divide-slate-700 overflow-y-auto flex-1">
            {filteredPosts.map((post) => {
              const catColor = categoryColors[post.category] || categoryColors.tech;
              return (
                <div
                  key={post.slug}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-slate-900 dark:text-white truncate">
                        {post.title}
                      </h3>
                      <span className={`shrink-0 inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${catColor.bg} ${catColor.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${catColor.dot}`}></span>
                        {(() => {
                          const translationKey = `category.${post.category}` as keyof typeof ui.zh;
                          return ui[lang][translationKey] || ui.zh[translationKey] || post.category;
                        })()}
                      </span>
                      {isDraft(post.draft) && (
                        <span className="shrink-0 px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded">
                          {lang === 'zh' ? '草稿' : 'Draft'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {post.description || (lang === 'zh' ? '暂无描述' : 'No description')}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-4">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {post.pubDate}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingPost({ ...post, draft: isDraft(post.draft) });
                          setView('edit');
                          setError('');
                          setSuccess('');
                        }}
                        className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors font-medium text-slate-700 dark:text-slate-300"
                      >
                        {lang === 'zh' ? '编辑' : 'Edit'}
                      </button>
                      <button
                        onClick={() => handleDelete(post.slug)}
                        className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium"
                      >
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

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setConfirmDialog(null)}
          />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md mx-4 overflow-hidden animate-fade-in">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {confirmDialog.title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {confirmDialog.message}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {lang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                {lang === 'zh' ? '确定' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
