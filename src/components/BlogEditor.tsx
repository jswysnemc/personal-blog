import { useState, useEffect, useRef } from 'react';
import { fetchPosts, createPost, updatePost, deletePost, type Post } from '../lib/api';
import { isAdminLoggedIn } from '../lib/auth';
import { ui, type Lang } from '../lib/i18n';
import { marked } from 'marked';
import MarkdownToolbar from './MarkdownToolbar';
import ArticleCard from './ArticleCard';
import ArticlesHeader from './ArticlesHeader';

interface Props {
  lang?: Lang;
}

const DEFAULT_CATEGORIES = ['tech', 'life', 'thoughts', 'tutorial', 'reading'] as const;

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
  const [view, setView] = useState<'list' | 'edit' | 'categories'>('list');
  const [editingPost, setEditingPost] = useState<Partial<Post> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editorMode, setEditorMode] = useState<'source' | 'preview' | 'split'>('source');
  const [categories, setCategories] = useState<string[]>([...DEFAULT_CATEGORIES]);
  const [newCategory, setNewCategory] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Undo/Redo history
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoRedoAction, setIsUndoRedoAction] = useState(false);

  const t = (key: keyof typeof ui.zh) => ui[lang][key] || ui.zh[key];
  const isDraft = (draft?: boolean | string) => draft === true || draft === 'true';

  // Calculate word and character count
  const wordCount = (editingPost?.content || '').trim().split(/\s+/).filter(Boolean).length;
  const charCount = (editingPost?.content || '').length;

  // Undo/Redo functions
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = () => {
    if (canUndo) {
      setIsUndoRedoAction(true);
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setEditingPost(prev => ({ ...prev, content: history[newIndex] }));
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      setIsUndoRedoAction(true);
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setEditingPost(prev => ({ ...prev, content: history[newIndex] }));
    }
  };

  // Track content changes for history
  useEffect(() => {
    if (isUndoRedoAction) {
      setIsUndoRedoAction(false);
      return;
    }

    if (view === 'edit' && editingPost?.content !== undefined) {
      const content = editingPost.content || '';

      // Don't add to history if content hasn't changed
      if (history[historyIndex] === content) return;

      // Add to history and trim future history if we're in the middle
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(content);

      // Limit history to last 50 entries
      if (newHistory.length > 50) {
        newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      } else {
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      }
    }
  }, [editingPost?.content, view]);

  // Initialize history when entering edit mode
  useEffect(() => {
    if (view === 'edit') {
      const initialContent = editingPost?.content || '';
      setHistory([initialContent]);
      setHistoryIndex(0);
    }
  }, [view]);

  // Handle Markdown insertion at cursor position
  const handleInsert = (text: string, cursorOffset: number = 0) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = editingPost?.content || '';

    const newContent = currentContent.substring(0, start) + text + currentContent.substring(end);
    setEditingPost(prev => ({ ...prev, content: newContent }));

    setTimeout(() => {
      const newCursorPos = start + text.length + cursorOffset;
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!textareaRef.current || view !== 'edit') return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
            break;
          case 'y':
            e.preventDefault();
            handleRedo();
            break;
          case 'b':
            if (editorMode === 'source') {
              e.preventDefault();
              handleInsert('**文本**', -3);
            }
            break;
          case 'i':
            if (editorMode === 'source') {
              e.preventDefault();
              handleInsert('*文本*', -2);
            }
            break;
          case 's':
            e.preventDefault();
            handleSave();
            break;
        }
      }

      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, editorMode, isFullscreen, editingPost, canUndo, canRedo]);

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
    if (!confirm(lang === 'zh' ? `确定要删除分类"${cat}"吗？` : `Delete category "${cat}"?`)) {
      return;
    }
    saveCategories(categories.filter(c => c !== cat));
    setSuccess(lang === 'zh' ? '分类已删除' : 'Category deleted');
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
      setView('list');
      setEditingPost(null);
      loadPosts();
    } catch {
      setError(lang === 'zh' ? '保存失败,请确保服务器正在运行' : 'Failed to save. Make sure the server is running.');
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
    const containerClass = isFullscreen
      ? 'fixed inset-0 z-50 bg-white dark:bg-slate-900'
      : 'bg-white dark:bg-slate-800 rounded-2xl shadow-sm dark:shadow-slate-900/50 border border-slate-200 dark:border-slate-700';

    return (
      <div className={`${containerClass} overflow-hidden flex flex-col`}>
        {/* Editor Header */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setView('list'); setEditingPost(null); setError(''); setIsFullscreen(false); }}
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
                onClick={handleUndo}
                disabled={!canUndo}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={lang === 'zh' ? '撤销 (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
              >
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={lang === 'zh' ? '重做 (Ctrl+Y / Ctrl+Shift+Z)' : 'Redo (Ctrl+Y / Ctrl+Shift+Z)'}
              >
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
              </button>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
              <button
                onClick={() => { setView('list'); setEditingPost(null); setError(''); setIsFullscreen(false); }}
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
                    {categories.map(cat => {
                      const translationKey = `category.${cat}` as keyof typeof ui.zh;
                      const displayName = ui[lang][translationKey] || ui.zh[translationKey] || cat;
                      return <option key={cat} value={cat}>{displayName}</option>;
                    })}
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
                    ({lang === 'zh' ? '按 Enter 添加' : 'press Enter to add'})
                  </span>
                </label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                    {(editingPost?.tags || []).map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm rounded-lg"
                      >
                        {tag}
                        <button
                          onClick={() => setEditingPost(prev => ({
                            ...prev,
                            tags: (prev?.tags || []).filter((_, i) => i !== idx)
                          }))}
                          className="hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
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
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl
                               focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800
                               transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white"
                    placeholder={lang === 'zh' ? '输入标签并按 Enter' : 'Type a tag and press Enter'}
                  />
                </div>
              </div>
            </div>

            {/* Draft Status */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {lang === 'zh' ? '草稿状态' : 'Draft Status'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {isDraft(editingPost?.draft)
                      ? (lang === 'zh' ? '此文章不会在博客列表中显示' : 'This post will not appear in the blog list')
                      : (lang === 'zh' ? '此文章将公开显示' : 'This post will be publicly visible')}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setEditingPost(prev => ({
                  ...prev,
                  draft: !isDraft(prev?.draft)
                }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  isDraft(editingPost?.draft)
                    ? 'bg-blue-600 dark:bg-blue-500'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isDraft(editingPost?.draft) ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Content Editor */}
            <div>
              {/* Toolbar and Mode Toggle */}
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  {lang === 'zh' ? '文章内容' : 'Content'}
                  <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">(Markdown)</span>
                </label>
                <div className="flex items-center gap-3">
                  {/* Word Count */}
                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span>{lang === 'zh' ? '字数' : 'Words'}: {wordCount}</span>
                    <span>{lang === 'zh' ? '字符' : 'Chars'}: {charCount}</span>
                  </div>
                  {/* Mode Toggle */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditorMode('source')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        editorMode === 'source'
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                      title={lang === 'zh' ? '源码模式' : 'Source mode'}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setEditorMode('split')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        editorMode === 'split'
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                      title={lang === 'zh' ? '分屏模式' : 'Split mode'}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4H5a2 2 0 00-2 2v14a2 2 0 002 2h4m0-18v18m0-18l10.5 0M9 22L19.5 22M14 4h5a2 2 0 012 2v14a2 2 0 01-2 2h-5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setEditorMode('preview')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        editorMode === 'preview'
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                      title={lang === 'zh' ? '预览模式' : 'Preview mode'}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Markdown Toolbar (only show in source/split mode) */}
              {(editorMode === 'source' || editorMode === 'split') && (
                <MarkdownToolbar onInsert={handleInsert} lang={lang} />
              )}

              {/* Editor Area */}
              <div className={`${editorMode === 'split' ? 'grid grid-cols-2 gap-4' : ''}`}>
                {/* Source Editor */}
                {(editorMode === 'source' || editorMode === 'split') && (
                  <div>
                    <textarea
                      ref={textareaRef}
                      value={editingPost?.content || ''}
                      onChange={e => setEditingPost(prev => ({ ...prev, content: e.target.value }))}
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl
                                 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800
                                 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 font-mono text-sm leading-relaxed text-slate-900 dark:text-white resize-y"
                      style={{ minHeight: editorMode === 'split' ? '660px' : '600px' }}
                      placeholder={lang === 'zh'
                        ? '# 标题\n\n正文内容...\n\n## 子标题\n\n- 列表项\n- 列表项\n\n```javascript\nconst code = "示例代码";\n```'
                        : '# Heading\n\nParagraph text...\n\n## Subheading\n\n- List item\n- List item\n\n```javascript\nconst code = "example";\n```'}
                    />
                  </div>
                )}

                {/* Preview */}
                {(editorMode === 'preview' || editorMode === 'split') && (
                  <div
                    className={`px-4 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl
                               prose prose-slate dark:prose-invert max-w-none overflow-auto ${editorMode === 'split' ? 'h-[660px]' : 'min-h-[500px]'}`}
                    dangerouslySetInnerHTML={{ __html: marked(editingPost?.content || (lang === 'zh' ? '暂无内容预览' : 'No content to preview')) }}
                  />
                )}
              </div>

              {/* Keyboard Shortcuts Help */}
              {editorMode !== 'preview' && (
                <div className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                  {lang === 'zh' ? '快捷键' : 'Shortcuts'}: Ctrl+Z {lang === 'zh' ? '撤销' : 'undo'}, Ctrl+Y {lang === 'zh' ? '重做' : 'redo'}, Ctrl+B {lang === 'zh' ? '粗体' : 'bold'}, Ctrl+I {lang === 'zh' ? '斜体' : 'italic'}, Ctrl+S {lang === 'zh' ? '保存' : 'save'}, Esc {lang === 'zh' ? '退出全屏' : 'exit fullscreen'}
                </div>
              )}
            </div>
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
      {/* Header with Search and Filters */}
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
        totalPosts={posts.length}
      />

      {/* Category Management Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setView('categories')}
          className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          {lang === 'zh' ? '管理分类' : 'Manage Categories'}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map((post, index) => {
            const catColor = categoryColors[post.category] || categoryColors.tech;
            return (
              <ArticleCard
                key={post.slug}
                post={post}
                lang={lang}
                categoryColor={catColor}
                isDraft={isDraft}
                onEdit={() => {
                  setEditingPost({ ...post, draft: isDraft(post.draft) });
                  setView('edit');
                  setError('');
                  setSuccess('');
                }}
                onDelete={() => handleDelete(post.slug)}
                index={index}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
