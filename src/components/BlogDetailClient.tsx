import { useState, useEffect, useMemo, useRef, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeSlug from 'rehype-slug';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { fetchPost, fetchPosts, fetchComments, submitComment as apiSubmitComment, deleteComment as apiDeleteComment, type Post, type Comment } from '../lib/api';
import { generateFingerprint } from '../lib/fingerprint';
import { mapFingerprintToName, generateAvatarColor } from '../lib/nameMapper';
import { isAdminLoggedIn, getToken } from '../lib/auth';
import { ui, type Lang } from '../lib/i18n';
import CodeBlock from './CodeBlock';
import MermaidBlock from './MermaidBlock';
import MathBlock, { InlineMath } from './MathBlock';
import TableOfContents from './TableOfContents';
import MentionInput from './MentionInput';
import CommentContent from './CommentContent';

interface Props {
  lang?: Lang;
  initialSlug?: string;
  authorName?: string;
}

const categoryStyles: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  tech: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', accent: 'bg-blue-500' },
  life: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', accent: 'bg-emerald-500' },
  thoughts: { bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-800', accent: 'bg-violet-500' },
  tutorial: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', accent: 'bg-amber-500' },
  reading: { bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800', accent: 'bg-rose-500' },
};

// Calculate reading time
const calculateReadingTime = (content: string): number => {
  const wordsPerMinute = 200;
  const chineseCharsPerMinute = 400;
  const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = content.replace(/[\u4e00-\u9fa5]/g, ' ').split(/\s+/).filter(Boolean).length;
  const minutes = Math.ceil((chineseChars / chineseCharsPerMinute) + (englishWords / wordsPerMinute));
  return Math.max(1, minutes);
};

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeSlug, rehypeRaw, rehypeKatex];

const MarkdownContent = memo(function MarkdownContent({ content }: { content: string }) {
  const components = useMemo(() => ({
    code({ node, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      const hasNewlines = codeString.includes('\n');
      const isInline = !match && !className && !hasNewlines;
      const language = match?.[1]?.toLowerCase();

      if (language === 'mermaid') {
        return <MermaidBlock>{codeString}</MermaidBlock>;
      }

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
    pre({ children }: any) {
      return <>{children}</>;
    },
  }), []);

  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
});

export default function BlogDetailClient({ lang = 'zh', initialSlug, authorName = 'Author' }: Props) {
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

  // All posts for navigation and recommendations
  const [allPosts, setAllPosts] = useState<Post[]>([]);

  // Breadcrumb sticky state
  const [isBreadcrumbSticky, setIsBreadcrumbSticky] = useState(false);
  const breadcrumbRef = useRef<HTMLDivElement>(null);
  const stickyStateRef = useRef(false);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const t = (key: keyof typeof ui.zh) => ui[lang][key] || ui.zh[key];
  const basePath = lang === 'zh' ? '' : `/${lang}`;

  // Get category name with fallback for custom categories
  const getCategoryName = (category: string) => {
    const translationKey = `category.${category}` as keyof typeof ui.zh;
    return ui[lang][translationKey] || ui.zh[translationKey] || category;
  };

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

  // Detect when breadcrumb scrolls out of view and show header version
  useEffect(() => {
    const handleScroll = () => {
      if (breadcrumbRef.current) {
        const rect = breadcrumbRef.current.getBoundingClientRect();
        // When breadcrumb bottom goes above header (64px), show header breadcrumb
        const isHidden = rect.bottom < 64;
        if (stickyStateRef.current === isHidden) {
          return;
        }
        stickyStateRef.current = isHidden;
        setIsBreadcrumbSticky(isHidden);

        // Toggle body class for header animation coordination
        if (isHidden) {
          document.body.classList.add('breadcrumb-in-header');
        } else {
          document.body.classList.remove('breadcrumb-in-header');
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.body.classList.remove('breadcrumb-in-header');
    };
  }, []);

  useEffect(() => {
    if (!isBreadcrumbSticky) return;
    const updateHeaderOffsets = () => {
      // Calculate logo offset (left boundary)
      const logo = document.querySelector('.header-logo');
      if (!logo) return;
      const icon = logo.querySelector('svg');
      const logoRect = (icon || logo).getBoundingClientRect();
      const gap = 12;
      const offset = Math.max(0, Math.round(logoRect.right + gap));
      document.documentElement.style.setProperty('--header-logo-offset', `${offset}px`);

      // Calculate header buttons width (right boundary)
      // Find the right-side nav items container
      const rightNav = document.querySelector('header nav > div');
      if (rightNav) {
        const rightNavRect = rightNav.getBoundingClientRect();
        const padding = 16;
        const rightWidth = Math.max(0, Math.round(window.innerWidth - rightNavRect.left + padding));
        document.documentElement.style.setProperty('--header-buttons-width', `${rightWidth}px`);
      }
    };
    const raf = requestAnimationFrame(updateHeaderOffsets);
    const timeout = window.setTimeout(updateHeaderOffsets, 350);
    window.addEventListener('resize', updateHeaderOffsets);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
      window.removeEventListener('resize', updateHeaderOffsets);
    };
  }, [isBreadcrumbSticky]);

  useEffect(() => {
    if (slug) {
      loadPost();
    }
  }, [slug]);

  async function loadPost() {
    try {
      setLoading(true);
      const [data, commentsData, postsData] = await Promise.all([
        fetchPost(slug),
        fetchComments(slug),
        fetchPosts()
      ]);
      setPost(data);
      setComments(commentsData);
      // Sort posts by date and filter out drafts
      const publishedPosts = postsData
        .filter(p => p.draft !== true && p.draft !== 'true')
        .sort((a, b) => new Date(b.pubDate).valueOf() - new Date(a.pubDate).valueOf());
      setAllPosts(publishedPosts);
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
      // Use author identity if admin, otherwise use anonymous visitor identity
      const commentAuthor = isAdmin ? authorName : visitorName;
      const commentColor = isAdmin ? '#8b5cf6' : visitorColor;
      const comment = await apiSubmitComment(slug, newComment.trim(), commentAuthor, commentColor, isAdmin);
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

  // Calculate previous and next posts
  const { prevPost, nextPost } = useMemo(() => {
    if (!post || allPosts.length === 0) return { prevPost: null, nextPost: null };
    const currentIndex = allPosts.findIndex(p => p.slug === post.slug);
    if (currentIndex === -1) return { prevPost: null, nextPost: null };
    return {
      prevPost: currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null,
      nextPost: currentIndex > 0 ? allPosts[currentIndex - 1] : null,
    };
  }, [post, allPosts]);

  // Calculate related posts based on matching tags
  const relatedPosts = useMemo(() => {
    if (!post || allPosts.length === 0) return [];
    const currentTags = new Set(post.tags || []);
    if (currentTags.size === 0) return [];

    return allPosts
      .filter(p => p.slug !== post.slug)
      .map(p => ({
        post: p,
        matchCount: (p.tags || []).filter(tag => currentTags.has(tag)).length
      }))
      .filter(item => item.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 3)
      .map(item => item.post);
  }, [post, allPosts]);

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

  const catStyle = categoryStyles[post.category] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', accent: 'bg-slate-500' };
  const readingTime = calculateReadingTime(post.content);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header-embedded breadcrumb - appears when scrolling, positioned after compressed logo */}
      {isBreadcrumbSticky && (
        <div
          className="fixed top-0 z-50 h-16 flex items-center pointer-events-none animate-breadcrumb-slide-in"
          style={{ left: 'var(--header-logo-offset, 0px)', right: 'var(--header-buttons-width, 200px)' }}
        >
          <nav
            className="flex items-center gap-2 text-sm pointer-events-auto h-full pr-4 w-full"
            aria-label="Breadcrumb"
          >
              <a
                href={`${basePath}/`}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </a>
              <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <a
                href={`${basePath}/blog`}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0 hidden sm:block"
              >
                {lang === 'zh' ? '博客' : 'Blog'}
              </a>
              <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-slate-700 dark:text-slate-300 font-medium truncate min-w-0">
                {post.title}
              </span>
          </nav>
        </div>
      )}

      {/* Original Breadcrumbs - normal flow, scrolls with page */}
      <div
        ref={breadcrumbRef}
        className="py-3 mb-6"
        style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)', paddingLeft: 'calc(50vw - 50%)', paddingRight: 'calc(50vw - 50%)' }}
      >
        <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
          <a
            href={`${basePath}/`}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </a>
          <svg className="w-4 h-4 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <a
            href={`${basePath}/blog`}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            {lang === 'zh' ? '博客' : 'Blog'}
          </a>
          <svg className="w-4 h-4 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[200px] sm:max-w-xs">
            {post.title}
          </span>
        </nav>
      </div>

      {/* Decorative Hero Background */}
      <div className="absolute inset-x-0 top-0 h-[400px] overflow-hidden pointer-events-none -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-slate-50/80 to-transparent dark:from-slate-900 dark:via-slate-900/80" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-3xl opacity-60" />
        <div className="absolute top-20 right-1/4 w-80 h-80 bg-purple-100 dark:bg-purple-900/20 rounded-full blur-3xl opacity-40" />
        <div className="absolute -top-10 right-1/3 w-64 h-64 bg-amber-100 dark:bg-amber-900/20 rounded-full blur-3xl opacity-30" />
      </div>

      <div className="flex gap-12">
        {/* Main Content */}
        <article className="flex-1 min-w-0">
          {/* Header */}
          <header className="mb-10 animate-fade-in">
            {/* Meta info - Enhanced */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {/* Category with accent bar */}
              <div className="flex items-center gap-2">
                <div className={`w-1 h-5 rounded-full ${catStyle.accent}`} />
                <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${catStyle.bg} ${catStyle.text} ${catStyle.border} border`}>
                  {getCategoryName(post.category)}
                </span>
              </div>

              <span className="text-slate-300 dark:text-slate-600">|</span>

              {/* Date with icon */}
              <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <time>{formatDate(post.pubDate)}</time>
              </div>

              <span className="text-slate-300 dark:text-slate-600">|</span>

              {/* Reading time with icon */}
              <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{lang === 'zh' ? `${readingTime} 分钟阅读` : `${readingTime} min read`}</span>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white mb-6 leading-tight tracking-tight">
              {post.title}
            </h1>

            {/* Description */}
            <p className="text-xl text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              {post.description}
            </p>

            {/* Tags - Enhanced */}
            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.tags.map(tag => (
                  <a
                    key={tag}
                    href={`${basePath}/blog?tag=${encodeURIComponent(tag)}`}
                    className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    {tag}
                  </a>
                ))}
              </div>
            )}

            {/* Divider */}
            <div className="mt-10 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-slate-600" />
          </header>

          {/* Content */}
          <div className="prose-article mb-20 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <MarkdownContent content={post.content} />
          </div>

          {/* Article Footer */}
          <div className="mb-16 animate-fade-in" style={{ animationDelay: '0.15s' }}>
            {/* End marker */}
            <div className="flex items-center justify-center gap-4 mb-10">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent to-slate-200 dark:to-slate-700" />
              <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span className="text-sm font-medium">
                  {lang === 'zh' ? '感谢阅读' : 'Thanks for reading'}
                </span>
              </div>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent to-slate-200 dark:to-slate-700" />
            </div>

            {/* Action buttons */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                {lang === 'zh' ? '返回顶部' : 'Back to top'}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {lang === 'zh' ? '觉得有用？' : 'Found it useful?'}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    showToast(lang === 'zh' ? '链接已复制！' : 'Link copied!', 'success');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  {lang === 'zh' ? '分享文章' : 'Share'}
                </button>
              </div>
            </div>
          </div>

          {/* Previous / Next Navigation */}
          {(prevPost || nextPost) && (
            <div className="mb-12 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Previous Post */}
                {prevPost ? (
                  <a
                    href={`${basePath}/blog/${prevPost.slug}`}
                    className="group p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                  >
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
                      <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span>{lang === 'zh' ? '上一篇' : 'Previous'}</span>
                    </div>
                    <h4 className="font-medium text-slate-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {prevPost.title}
                    </h4>
                  </a>
                ) : (
                  <div />
                )}

                {/* Next Post */}
                {nextPost ? (
                  <a
                    href={`${basePath}/blog/${nextPost.slug}`}
                    className="group p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-right"
                  >
                    <div className="flex items-center justify-end gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
                      <span>{lang === 'zh' ? '下一篇' : 'Next'}</span>
                      <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-medium text-slate-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {nextPost.title}
                    </h4>
                  </a>
                ) : (
                  <div />
                )}
              </div>
            </div>
          )}

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <div className="mb-12 animate-fade-in" style={{ animationDelay: '0.25s' }}>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {lang === 'zh' ? '相关推荐' : 'Related Posts'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {relatedPosts.map(relatedPost => {
                  const relatedCatStyle = categoryStyles[relatedPost.category] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', accent: 'bg-slate-500' };
                  return (
                    <a
                      key={relatedPost.slug}
                      href={`${basePath}/blog/${relatedPost.slug}`}
                      className="group p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${relatedCatStyle.bg} ${relatedCatStyle.text}`}>
                          {getCategoryName(relatedPost.category)}
                        </span>
                      </div>
                      <h4 className="font-medium text-slate-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-sm">
                        {relatedPost.title}
                      </h4>
                      {relatedPost.tags && relatedPost.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {relatedPost.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[10px] text-slate-400 dark:text-slate-500">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

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
            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                {isAdmin ? (
                  <a
                    href={lang === 'zh' ? '/about' : '/en/about'}
                    className="flex items-center gap-3 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm shadow-sm group-hover:shadow-md transition-shadow">
                      {authorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t('comment.identity')}</p>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{authorName}</p>
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                          {lang === 'zh' ? '作者' : 'Author'}
                        </span>
                      </div>
                    </div>
                  </a>
                ) : (
                  <>
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
                  </>
                )}
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
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium shrink-0 shadow-sm ${comment.isAuthor ? 'bg-gradient-to-br from-blue-500 to-purple-600' : ''}`}
                    style={comment.isAuthor ? undefined : { backgroundColor: comment.authorColor }}
                  >
                    {comment.author.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`font-medium ${comment.isAuthor ? 'text-slate-900 dark:text-white' : ''}`} style={comment.isAuthor ? undefined : { color: comment.authorColor }}>
                        {comment.author}
                      </span>
                      {comment.isAuthor && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                          {lang === 'zh' ? '作者' : 'Author'}
                        </span>
                      )}
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
          {/* Author Card */}
          <a
            href={lang === 'zh' ? '/about' : '/en/about'}
            className="mb-6 flex items-center gap-3 group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:shadow-lg transition-shadow">
              {authorName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{authorName}</span>
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                  {lang === 'zh' ? '作者' : 'Author'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'zh' ? '热爱技术与分享' : 'Tech enthusiast'}
              </p>
            </div>
          </a>

          <TableOfContents content={post.content} lang={lang} />
        </aside>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm border transition-all duration-300 ${
              toast.type === 'success'
                ? 'bg-emerald-50/95 dark:bg-emerald-900/95 border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                : toast.type === 'error'
                ? 'bg-red-50/95 dark:bg-red-900/95 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
                : 'bg-blue-50/95 dark:bg-blue-900/95 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200'
            }`}
          >
            {toast.type === 'success' && (
              <svg className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toast.type === 'info' && (
              <svg className="w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
