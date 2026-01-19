import type { Post } from '../lib/api';
import type { Lang } from '../lib/i18n';

interface Props {
  post: Post;
  lang: Lang;
  categoryColor: { bg: string; text: string; dot: string };
  isDraft: (draft?: boolean | string) => boolean;
  onEdit: () => void;
  onDelete: () => void;
  index: number;
}

export default function ArticleCard({ post, lang, categoryColor, isDraft, onEdit, onDelete, index }: Props) {
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
    <article
      className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200 dark:hover:shadow-slate-900/50"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="p-6">
        {/* Status & Category */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${categoryColor.bg} ${categoryColor.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${categoryColor.dot}`}></span>
              {getCategoryName(post.category)}
            </span>
            {isDraft(post.draft) && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full font-medium">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                {lang === 'zh' ? '草稿' : 'Draft'}
              </span>
            )}
          </div>
          <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold mb-3 line-clamp-2 leading-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {post.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
          {post.description}
        </p>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                {tag}
              </span>
            ))}
            {post.tags.length > 3 && (
              <span className="text-xs px-2 py-1 text-slate-400">
                +{post.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
          <span className="text-xs text-slate-500 dark:text-slate-400">{post.pubDate}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors font-medium"
            >
              {lang === 'zh' ? '编辑' : 'Edit'}
            </button>
            <button
              onClick={onDelete}
              className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium"
            >
              {lang === 'zh' ? '删除' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
