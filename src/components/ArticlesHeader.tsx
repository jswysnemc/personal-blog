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
    <div className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold mb-2 text-slate-900 dark:text-white">
            {lang === 'zh' ? '文章管理' : 'Articles'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            {lang === 'zh' ? `共 ${totalPosts} 篇文章` : `${totalPosts} article${totalPosts !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={onNewPost}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-blue-500/50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {lang === 'zh' ? '新建文章' : 'New Article'}
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={lang === 'zh' ? '搜索文章标题、内容...' : 'Search articles...'}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-900 dark:text-white"
        >
          <option value="all">{lang === 'zh' ? '所有分类' : 'All Categories'}</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{getCategoryName(cat)}</option>
          ))}
        </select>
        <select
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-900 dark:text-white"
        >
          <option value="all">{lang === 'zh' ? '全部状态' : 'All Status'}</option>
          <option value="published">{lang === 'zh' ? '已发布' : 'Published'}</option>
          <option value="draft">{lang === 'zh' ? '草稿' : 'Draft'}</option>
        </select>
      </div>
    </div>
  );
}
