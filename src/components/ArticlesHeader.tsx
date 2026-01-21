import type { Lang } from '../lib/i18n';

interface Props {
  lang: Lang;
  searchQuery: string;
  selectedCategory: string;
  selectedStatus: string;
  categories: string[];
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onStatusChange: (status: string) => void;
  onNewPost: () => void;
  onManageCategories: () => void;
  totalPosts: number;
}

export default function ArticlesHeader({
  lang,
  searchQuery,
  selectedCategory,
  selectedStatus,
  categories,
  onSearchChange,
  onCategoryChange,
  onStatusChange,
  onNewPost,
  onManageCategories,
  totalPosts,
}: Props) {
  const getCategoryName = (category: string) => {
    const categoryNames: Record<string, { zh: string; en: string }> = {
      tech: { zh: '技术', en: 'Tech' },
      life: { zh: '生活', en: 'Life' },
      thoughts: { zh: '随想', en: 'Thoughts' },
      tutorial: { zh: '教程', en: 'Tutorial' },
      reading: { zh: '阅读', en: 'Reading' },
    };
    return categoryNames[category]?.[lang] || category;
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Title and count */}
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {lang === 'zh' ? '文章管理' : 'Articles'}
          </h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {lang === 'zh' ? `${totalPosts} 篇` : `${totalPosts}`}
          </span>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="relative max-w-xs">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={lang === 'zh' ? '搜索...' : 'Search...'}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-900 dark:text-white"
          >
            <option value="all">{lang === 'zh' ? '所有分类' : 'All Categories'}</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{getCategoryName(cat)}</option>
            ))}
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-900 dark:text-white"
          >
            <option value="all">{lang === 'zh' ? '全部状态' : 'All Status'}</option>
            <option value="published">{lang === 'zh' ? '已发布' : 'Published'}</option>
            <option value="draft">{lang === 'zh' ? '草稿' : 'Draft'}</option>
          </select>
          <button
            onClick={onManageCategories}
            className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            {lang === 'zh' ? '分类' : 'Tags'}
          </button>
          <button
            onClick={onNewPost}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium flex items-center gap-1.5 transition-all hover:shadow-lg hover:shadow-blue-500/30 whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {lang === 'zh' ? '新建' : 'New'}
          </button>
        </div>
      </div>
    </div>
  );
}
