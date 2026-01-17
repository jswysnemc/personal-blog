import { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { fetchPost, fetchComments, submitComment as apiSubmitComment, deleteComment as apiDeleteComment, type Post, type Comment } from '../lib/api';
import { generateFingerprint } from '../lib/fingerprint';
import { mapFingerprintToName, generateAvatarColor } from '../lib/nameMapper';
import { isAdminLoggedIn, getToken } from '../lib/auth';
import { ui, type Lang } from '../lib/i18n';
import CodeBlock from './CodeBlock';
import TableOfContents from './TableOfContents';
import MentionInput from './MentionInput';
import CommentContent from './CommentContent';

interface Props {
  lang?: Lang;
  initialSlug?: string;
}

const categoryStyles: Record<string, { bg: string; text: string; border: string }> = {
  tech: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  life: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  thoughts: { bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-800' },
  tutorial: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  reading: { bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' },
};

export default function BlogDetailClient({ lang = 'zh', initialSlug }: Props) {
  const [slug, setSlug] = useState<string>(initialSlug || '');
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Comment state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [visitorColor, setVisitorColor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const t = (key: keyof typeof ui.zh) => ui[lang][key] || ui.zh[key];
  const basePath = lang === 'zh' ? '' : `/${lang}`;

  useEffect(() => {
    if (!initialSlug) {
      const params = new URLSearchParams(window.location.search);
      const slugParam = params.get('slug');
      if (slugParam) {
        setSlug(slugParam);
      } else {
        setLoading(false);
        setError(lang === 'zh' ? '未指定文章' : 'No post specified');
      }
    }
    initVisitor();

    // Re-check admin status when page gains focus (user may have logged in/out in another tab)
    const handleFocus = () => {
      setIsAdmin(isAdminLoggedIn());
    };
    window.addEventListener('focus', handleFocus);

    // Also check periodically for storage changes
    const handleStorageChange = () => {
      setIsAdmin(isAdminLoggedIn());
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [initialSlug]);

  useEffect(() => {
    if (slug) {
      loadPost();
    }
  }, [slug]);

  async function loadPost() {
    try {
      setLoading(true);
      const data = await fetchPost(slug);
      setPost(data);
      const commentsData = await fetchComments(slug);
      setComments(commentsData);
      setError('');
    } catch (err) {
      setError(lang === 'zh' ? '加载文章失败' : 'Failed to load post');
    } finally {
      setLoading(false);
    }
  }

  async function initVisitor() {
    const fp = await generateFingerprint();
    setVisitorName(mapFingerprintToName(fp));
    setVisitorColor(generateAvatarColor(fp));
    setIsAdmin(isAdminLoggedIn());
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const comment = await apiSubmitComment(slug, newComment.trim(), visitorName, visitorColor);
      setComments(prev => [...prev, comment]);
      setNewComment('');
    } catch (error) {
      console.error('Failed to submit comment:', error);
    }
    setIsSubmitting(false);
  };

  const handleDeleteComment = async (commentId: number) => {
    const token = getToken();
    if (!isAdmin || !token) return;
    try {
      await apiDeleteComment(slug, commentId, token);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (error) {
      console.error('Failed to delete comment:', error);
      // If unauthorized, refresh admin status
      if (error instanceof Error && error.message === 'Unauthorized') {
        setIsAdmin(false);
      }
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCommentDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get unique comment authors for @ mentions
  const mentionUsers = useMemo(() => {
    const userMap = new Map<string, string>();
    comments.forEach(c => {
      if (!userMap.has(c.author)) {
        userMap.set(c.author, c.authorColor);
      }
    });
    // Also include current visitor
    if (visitorName && !userMap.has(visitorName)) {
      userMap.set(visitorName, visitorColor);
    }
    return Array.from(userMap.entries()).map(([name, color]) => ({ name, color }));
  }, [comments, visitorName, visitorColor]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-slate-300 dark:border-slate-600 border-t-slate-600 dark:border-t-slate-300 rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {lang === 'zh' ? '加载中...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !post) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{error || (lang === 'zh' ? '文章不存在' : 'Post not found')}</p>
          <a
            href={`${basePath}/blog`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium rounded-lg
                       hover:bg-slate-800 dark:hover:bg-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {lang === 'zh' ? '返回博客列表' : 'Back to blog'}
          </a>
        </div>
      </div>
    );
  }

  const catStyle = categoryStyles[post.category] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex gap-12">
        {/* Main Content */}
        <article className="flex-1 min-w-0">
          {/* Header */}
          <header className="mb-10 animate-fade-in">
            {/* Back link */}
            <a
              href={`${basePath}/blog`}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors mb-8 group"
            >
              <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {lang === 'zh' ? '返回文章列表' : 'Back to articles'}
            </a>

            {/* Meta info */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${catStyle.bg} ${catStyle.text} ${catStyle.border} border`}>
                {t(`category.${post.category}` as keyof typeof ui.zh)}
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <time className="text-sm text-slate-500 dark:text-slate-400">{formatDate(post.pubDate)}</time>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white mb-6 leading-tight tracking-tight">
              {post.title}
            </h1>

            {/* Description */}
            <p className="text-xl text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              {post.description}
            </p>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.tags.map(tag => (
                  <span key={tag} className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-default">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Divider */}
            <div className="mt-10 h-px bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700" />
          </header>

          {/* Content */}
          <div className="prose-article mb-20 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSlug]}
              components={{
                code({ node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const codeString = String(children).replace(/\n$/, '');
                  const hasNewlines = codeString.includes('\n');
                  const isInline = !match && !className && !hasNewlines;

                  if (isInline) {
                    return (
                      <code {...props}>
                        {children}
                      </code>
                    );
                  }

                  return (
                    <CodeBlock language={match?.[1]}>
                      {codeString}
                    </CodeBlock>
                  );
                },
                pre({ children }) {
                  return <>{children}</>;
                },
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>

          {/* Comments Section */}
          <section className="mt-16 pt-10 border-t border-slate-200 dark:border-slate-700 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-8 flex items-center gap-3">
              <svg className="w-6 h-6 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {t('comment.title')}
              {comments.length > 0 && (
                <span className="text-sm font-normal text-slate-400 dark:text-slate-500">({comments.length})</span>
              )}
            </h2>

            {/* Visitor identity */}
            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm shadow-sm"
                  style={{ backgroundColor: visitorColor }}
                >
                  {visitorName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('comment.identity')}</p>
                  <p className="font-medium" style={{ color: visitorColor }}>{visitorName}</p>
                </div>
              </div>
            </div>

            {/* Comment form */}
            <form onSubmit={handleSubmitComment} className="mb-10">
              <MentionInput
                value={newComment}
                onChange={setNewComment}
                placeholder={t('comment.placeholder')}
                maxLength={2000}
                mentionUsers={mentionUsers}
                rows={4}
                className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none
                           focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 transition-all
                           placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
              />
              <div className="flex justify-between items-center mt-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400 dark:text-slate-500">
                    {newComment.length}/2000
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {lang === 'zh' ? '输入 @ 可以提及其他用户' : 'Type @ to mention users'}
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !newComment.trim()}
                  className="px-6 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium rounded-lg
                             hover:bg-slate-800 dark:hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed
                             transition-all duration-200 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 dark:border-slate-900/30 border-t-white dark:border-t-slate-900 rounded-full animate-spin" />
                      {t('comment.submitting')}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      {t('comment.submit')}
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Comments list */}
            <div className="space-y-6">
              {comments.map((comment, index) => (
                <article
                  key={comment.id}
                  className="flex gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium shrink-0 shadow-sm"
                    style={{ backgroundColor: comment.authorColor }}
                  >
                    {comment.author.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium" style={{ color: comment.authorColor }}>
                        {comment.author}
                      </span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <time className="text-sm text-slate-400 dark:text-slate-500">
                        {formatCommentDate(comment.createdAt)}
                      </time>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="ml-auto text-sm text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 transition-colors flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          {t('comment.delete')}
                        </button>
                      )}
                    </div>
                    <CommentContent content={comment.content} mentionUsers={mentionUsers} />
                  </div>
                </article>
              ))}

              {comments.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">{t('comment.empty')}</p>
                </div>
              )}
            </div>
          </section>
        </article>

        {/* Table of Contents Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <TableOfContents content={post.content} lang={lang} />
        </aside>
      </div>
    </div>
  );
}
