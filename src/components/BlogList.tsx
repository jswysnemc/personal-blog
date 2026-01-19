import { useState, useEffect, useMemo } from 'react';
import { fetchPosts, type Post } from '../lib/api';
import { ui, type Lang } from '../lib/i18n';

interface Props {
  lang?: Lang;
  initialCategory?: string;
  initialTag?: string;
}

const categoryColors: Record<string, string> = {
  tech: 'text-blue-600 border-blue-600 bg-blue-50',
  life: 'text-green-600 border-green-600 bg-green-50',
  thoughts: 'text-purple-600 border-purple-600 bg-purple-50',
  tutorial: 'text-orange-600 border-orange-600 bg-orange-50',
  reading: 'text-pink-600 border-pink-600 bg-pink-50',
};

const categoryBgColors: Record<string, string> = {
  tech: 'bg-blue-600',
  life: 'bg-green-600',
  thoughts: 'bg-purple-600',
  tutorial: 'bg-orange-600',
  reading: 'bg-pink-600',
};

export default function BlogList({ lang = 'zh', initialCategory, initialTag }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory || null);
  const [selectedTag, setSelectedTag] = useState<string | null>(initialTag || null);
  const [searchQuery, setSearchQuery] = useState('');

  const t = (key: keyof typeof ui.zh) => ui[lang][key] || ui.zh[key];
  const basePath = lang === 'zh' ? '' : `/${lang}`;

  // Get category name with fallback for custom categories
  const getCategoryName = (category: string) => {
    const translationKey = `category.${category}` as keyof typeof ui.zh;
    return ui[lang][translationKey] || ui.zh[translationKey] || category;
  };

  // Read tag from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tagParam = params.get('tag');
      if (tagParam) {
        setSelectedTag(tagParam);
      }
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, []);

  async function loadPosts() {
    try {
      setLoading(true);
      const data = await fetchPosts();
      // Sort by date, newest first
      data.sort((a, b) => new Date(b.pubDate).valueOf() - new Date(a.pubDate).valueOf());
      // draft 可能是字符串 "true"/"false" 或布尔值
      setPosts(data.filter(p => p.draft !== true && p.draft !== 'true'));
      setError('');
    } catch (err) {
      setError(lang === 'zh' ? '加载文章失败，请确保服务器正在运行' : 'Failed to load posts. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  }

  // Get unique categories with counts
  const categoriesWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [posts]);

  // Get unique tags with counts
  const tagsWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach(p => {
      p.tags.forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [posts]);

  // Filter posts
  const filteredPosts = useMemo(() => {
    let result = posts;

    // Filter by category
    if (selectedCategory) {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Filter by tag
    if (selectedTag) {
      result = result.filter(p => p.tags.includes(selectedTag));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return result;
  }, [posts, selectedCategory, selectedTag, searchQuery]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedTag(null);
    setSearchQuery('');
  };

  const hasActiveFilters = selectedCategory || selectedTag || searchQuery.trim();

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        {lang === 'zh' ? '加载中...' : 'Loading...'}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={loadPosts}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
        >
          {lang === 'zh' ? '重试' : 'Retry'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-8">
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'zh' ? '搜索文章标题、描述或标签...' : 'Search posts by title, description or tags...'}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-sm text-gray-500">
              {lang === 'zh' ? '筛选条件:' : 'Filters:'}
            </span>
            {selectedCategory && (
              <span className={`inline-flex items-center gap-1 px-2 py-1 text-sm rounded-full ${categoryColors[selectedCategory] || 'bg-gray-100 text-gray-600'}`}>
                {getCategoryName(selectedCategory)}
                <button onClick={() => setSelectedCategory(null)} className="hover:opacity-70">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {selectedTag && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-gray-100 text-gray-600 rounded-full">
                #{selectedTag}
                <button onClick={() => setSelectedTag(null)} className="hover:opacity-70">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-gray-100 text-gray-600 rounded-full">
                "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:opacity-70">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              {lang === 'zh' ? '清除全部' : 'Clear all'}
            </button>
          </div>
        )}

        {/* Results count */}
        <div className="text-sm text-gray-500 mb-4">
          {lang === 'zh'
            ? `共 ${filteredPosts.length} 篇文章`
            : `${filteredPosts.length} post${filteredPosts.length !== 1 ? 's' : ''}`}
        </div>

        {/* Post List */}
        <div className="space-y-4">
          {filteredPosts.map(post => (
            <article key={post.slug} className="blog-card group border border-gray-100 rounded-lg p-5 hover:border-gray-200 hover:shadow-sm transition-all">
              <a href={`${basePath}/blog/${post.slug}`} className="block">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`category-badge text-xs ${categoryColors[post.category] || 'text-gray-600 border-gray-600'}`}>
                    {getCategoryName(post.category)}
                  </span>
                  <time className="text-sm text-gray-400">{formatDate(post.pubDate)}</time>
                </div>

                <h2 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors">
                  {post.title}
                </h2>

                <p className="text-gray-600 leading-relaxed mb-4 line-clamp-2">
                  {post.description}
                </p>

                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {post.tags.slice(0, 5).map(tag => (
                      <span key={tag} className="text-xs text-gray-400">#{tag}</span>
                    ))}
                  </div>
                )}
              </a>
            </article>
          ))}
        </div>

        {filteredPosts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">
              {hasActiveFilters
                ? (lang === 'zh' ? '没有找到匹配的文章' : 'No matching posts found')
                : t('blog.noPosts')}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
              >
                {lang === 'zh' ? '清除筛选条件' : 'Clear filters'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-8 space-y-8">
          {/* Categories */}
          {categoriesWithCounts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {lang === 'zh' ? '分类' : 'Categories'}
              </h3>
              <div className="space-y-1">
                {categoriesWithCounts.map(([cat, count]) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                      selectedCategory === cat
                        ? `${categoryBgColors[cat] || 'bg-gray-900'} text-white`
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span>{getCategoryName(cat)}</span>
                    <span className={`text-xs ${selectedCategory === cat ? 'text-white/70' : 'text-gray-400'}`}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {tagsWithCounts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {lang === 'zh' ? '标签' : 'Tags'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {tagsWithCounts.slice(0, 15).map(([tag, count]) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`px-2 py-1 text-xs rounded-full transition-colors ${
                      selectedTag === tag
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    #{tag}
                    <span className="ml-1 opacity-60">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{posts.length}</div>
            <div className="text-sm text-gray-500">
              {lang === 'zh' ? '篇文章' : 'Total Posts'}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
