import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import type { LazyExoticComponent, ForwardRefExoticComponent, PropsWithoutRef, RefAttributes } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeSlug from 'rehype-slug';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import CodeBlock from '../CodeBlock';
import MermaidBlock from '../MermaidBlock';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import type { SourceEditorHandle, SourceEditorProps } from './SourceEditor';

const SourceEditor = lazy(() => import('./SourceEditor')) as LazyExoticComponent<
  ForwardRefExoticComponent<
    PropsWithoutRef<SourceEditorProps> & RefAttributes<SourceEditorHandle>
  >
>;

export type EditorMode = 'source' | 'wysiwyg' | 'split';

interface Props {
  value: string;
  onChange: (value: string) => void;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  lang?: 'zh' | 'en';
  className?: string;
  minHeight?: string;
}

function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return isDark;
}

function EditorLoading() {
  return (
    <div className="flex items-center justify-center min-h-[400px] bg-slate-50 dark:bg-slate-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-slate-200 dark:border-slate-700 border-t-slate-600 dark:border-t-slate-300 rounded-full animate-spin" />
        <span className="text-sm text-slate-500 dark:text-slate-400">Loading editor...</span>
      </div>
    </div>
  );
}

function PreviewPanel({ content, lang }: { content: string; lang: 'zh' | 'en' }) {
  return (
    <div className="prose-article">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeSlug, rehypeRaw, rehypeKatex]}
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const hasNewlines = codeString.includes('\n');
            const isInline = !match && !className && !hasNewlines;
            const language = match?.[1]?.toLowerCase();

            if (language === 'mermaid') {
              return <MermaidBlock>{codeString}</MermaidBlock>;
            }

            if (isInline) {
              return <code {...props}>{children}</code>;
            }

            return <CodeBlock language={match?.[1]}>{codeString}</CodeBlock>;
          },
          pre({ children }) {
            return <>{children}</>;
          },
        }}
      >
        {content || (lang === 'zh' ? '暂无内容预览' : 'No content to preview')}
      </ReactMarkdown>
    </div>
  );
}

function VditorEditor({
  value,
  onChange,
  isDark,
  lang,
  minHeight,
  onScroll,
  scrollToPercent,
}: {
  value: string;
  onChange: (value: string) => void;
  isDark: boolean;
  lang: 'zh' | 'en';
  minHeight: string;
  onScroll?: (percent: number) => void;
  scrollToPercent?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vditorRef = useRef<Vditor | null>(null);
  const isUpdatingFromExternal = useRef(false);
  const isProgrammaticScroll = useRef(false);
  const lastExternalValue = useRef(value);
  const initialValueRef = useRef(value);
  const onScrollRef = useRef(onScroll);
  const initialScrollPercentRef = useRef(scrollToPercent);
  const resolvedHeight = minHeight?.trim() || '600px';
  const pxMatch = resolvedHeight.match(/^(\d+(?:\.\d+)?)px$/);
  const numericMatch = resolvedHeight.match(/^(\d+(?:\.\d+)?)$/);
  const heightOption = numericMatch ? Number(numericMatch[1]) : resolvedHeight;
  const minHeightOption = pxMatch ? Number(pxMatch[1]) : (numericMatch ? Number(numericMatch[1]) : undefined);

  useEffect(() => {
    initialScrollPercentRef.current = scrollToPercent;
  }, [scrollToPercent]);

  useEffect(() => {
    onScrollRef.current = onScroll;
  }, [onScroll]);

  useEffect(() => {
    initialValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!containerRef.current) return;

    const vditor = new Vditor(containerRef.current, {
      height: heightOption,
      ...(typeof minHeightOption === 'number' ? { minHeight: minHeightOption } : {}),
      mode: 'ir',
      theme: isDark ? 'dark' : 'classic',
      icon: 'material',
      lang: lang === 'zh' ? 'zh_CN' : 'en_US',
      placeholder: lang === 'zh' ? '开始写作...' : 'Start writing...',
      value: '',
      cdn: '/vditor',
      cache: {
        enable: false,
      },
      preview: {
        theme: {
          current: isDark ? 'dark' : 'light',
        },
        hljs: {
          style: isDark ? 'github-dark' : 'github',
          lineNumber: true,
        },
        math: {
          engine: 'KaTeX',
        },
        markdown: {
          codeBlockPreview: false,
        },
      },
      toolbar: [
        'headings',
        'bold',
        'italic',
        'strike',
        'link',
        '|',
        'list',
        'ordered-list',
        'check',
        'outdent',
        'indent',
        '|',
        'quote',
        'line',
        'code',
        'inline-code',
        'table',
        '|',
        'undo',
        'redo',
        '|',
        'fullscreen',
        'outline',
      ],
      counter: {
        enable: true,
        type: 'text',
      },
      outline: {
        enable: false,
        position: 'right',
      },
      input: (content: string) => {
        if (!isUpdatingFromExternal.current) {
          onChange(content);
        }
      },
      after: () => {
        vditorRef.current = vditor;
        lastExternalValue.current = initialValueRef.current;
        vditor.setValue(initialValueRef.current);

        // Add scroll listener to Vditor's content area
        const contentEl = containerRef.current?.querySelector('.vditor-ir');
        if (contentEl) {
          contentEl.addEventListener('scroll', () => {
            if (isProgrammaticScroll.current) return;
            if (onScrollRef.current) {
              const maxScroll = contentEl.scrollHeight - contentEl.clientHeight;
              const percent = maxScroll > 0 ? contentEl.scrollTop / maxScroll : 0;
              onScrollRef.current(percent);
            }
          });

          // Apply initial scroll position after content is ready
          if (initialScrollPercentRef.current !== undefined && initialScrollPercentRef.current > 0) {
            requestAnimationFrame(() => {
              const maxScroll = contentEl.scrollHeight - contentEl.clientHeight;
              if (maxScroll > 0) {
                isProgrammaticScroll.current = true;
                contentEl.scrollTop = maxScroll * initialScrollPercentRef.current!;
                requestAnimationFrame(() => {
                  isProgrammaticScroll.current = false;
                });
              }
            });
          }
        }
      },
    });

    return () => {
      vditor.destroy();
      vditorRef.current = null;
    };
  }, [isDark, lang, minHeight]);

  // Scroll to percent when prop changes
  useEffect(() => {
    if (vditorRef.current && scrollToPercent !== undefined) {
      const contentEl = containerRef.current?.querySelector('.vditor-ir');
      if (contentEl) {
        const maxScroll = contentEl.scrollHeight - contentEl.clientHeight;
        const targetScroll = maxScroll * scrollToPercent;
        if (Math.abs(contentEl.scrollTop - targetScroll) > 1) {
          isProgrammaticScroll.current = true;
          contentEl.scrollTop = targetScroll;
          requestAnimationFrame(() => {
            isProgrammaticScroll.current = false;
          });
        }
      }
    }
  }, [scrollToPercent]);

  useEffect(() => {
    if (vditorRef.current && value !== lastExternalValue.current) {
      lastExternalValue.current = value;
      isUpdatingFromExternal.current = true;
      vditorRef.current.setValue(value);
      isUpdatingFromExternal.current = false;
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="vditor-container"
      style={{ height: resolvedHeight }}
    />
  );
}

export default function MarkdownEditor({
  value,
  onChange,
  mode,
  onModeChange,
  lang = 'zh',
  className = '',
  minHeight = '600px',
}: Props) {
  const isDark = useIsDarkMode();
  const [localValue, setLocalValue] = useState(value);
  const previewRef = useRef<HTMLDivElement>(null);
  const sourceEditorRef = useRef<SourceEditorHandle | null>(null);
  const scrollPercentRef = useRef(0);

  // Scroll and cursor sync state
  const [cursorPos, setCursorPos] = useState(0);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback((newValue: string) => {
    setLocalValue(newValue);
    onChange(newValue);
  }, [onChange]);

  // Handle source editor scroll (left → right in split mode, and store for mode sync)
  const handleSourceScroll = useCallback((percent: number) => {
    if (isScrollingRef.current) return;
    scrollPercentRef.current = percent;
    if (previewRef.current) {
      isScrollingRef.current = true;
      const previewEl = previewRef.current;
      const maxScroll = previewEl.scrollHeight - previewEl.clientHeight;
      previewEl.scrollTop = maxScroll * percent;
      requestAnimationFrame(() => {
        isScrollingRef.current = false;
      });
    }
  }, []);

  // Handle preview scroll (right → left in split mode)
  const handlePreviewScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isScrollingRef.current) return;
    const target = e.currentTarget;
    const maxScroll = target.scrollHeight - target.clientHeight;
    const percent = maxScroll > 0 ? target.scrollTop / maxScroll : 0;
    scrollPercentRef.current = percent;
    if (sourceEditorRef.current) {
      isScrollingRef.current = true;
      sourceEditorRef.current.scrollToPercent(percent);
      requestAnimationFrame(() => {
        isScrollingRef.current = false;
      });
    }
  }, []);

  // Handle cursor position change
  const handleCursorChange = useCallback((pos: number) => {
    setCursorPos(pos);
  }, []);

  const wordCount = localValue.trim().split(/\s+/).filter(Boolean).length;
  const charCount = localValue.length;

  const placeholder = lang === 'zh'
    ? '# 标题\n\n正文内容...\n\n## 子标题\n\n- 列表项\n- 列表项\n\n```javascript\nconst code = "示例代码";\n```'
    : '# Heading\n\nParagraph text...\n\n## Subheading\n\n- List item\n- List item\n\n```javascript\nconst code = "example";\n```';

  return (
    <div className={`markdown-editor ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {lang === 'zh' ? '文章内容' : 'Content'}
          <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">(Markdown)</span>
        </label>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span>{lang === 'zh' ? '字数' : 'Words'}: {wordCount}</span>
            <span>{lang === 'zh' ? '字符' : 'Chars'}: {charCount}</span>
          </div>
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              onClick={() => onModeChange('source')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                mode === 'source'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={lang === 'zh' ? '源码模式' : 'Source mode'}
            >
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="hidden sm:inline">{lang === 'zh' ? '源码' : 'Source'}</span>
              </div>
            </button>
            <button
              onClick={() => onModeChange('wysiwyg')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                mode === 'wysiwyg'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={lang === 'zh' ? '即时渲染 (Typora风格)' : 'Instant Rendering (Typora-like)'}
            >
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span className="hidden sm:inline">{lang === 'zh' ? 'IR' : 'IR'}</span>
              </div>
            </button>
            <button
              onClick={() => onModeChange('split')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                mode === 'split'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={lang === 'zh' ? '分屏对照' : 'Split view'}
            >
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4H5a2 2 0 00-2 2v14a2 2 0 002 2h4m0-18v18m0-18l10.5 0M9 22L19.5 22M14 4h5a2 2 0 012 2v14a2 2 0 01-2 2h-5" />
                </svg>
                <span className="hidden sm:inline">{lang === 'zh' ? '对照' : 'Split'}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div
        className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden"
        style={{ height: minHeight }}
      >
        {mode === 'source' && (
          <Suspense fallback={<EditorLoading />}>
            <SourceEditor
              ref={sourceEditorRef}
              value={localValue}
              onChange={handleChange}
              isDark={isDark}
              placeholder={placeholder}
              className="h-full overflow-auto"
              onScroll={(percent) => {
                scrollPercentRef.current = percent;
              }}
              onCursorChange={handleCursorChange}
              scrollToPercent={scrollPercentRef.current}
              cursorPos={cursorPos}
            />
          </Suspense>
        )}

        {mode === 'wysiwyg' && (
          <VditorEditor
            value={localValue}
            onChange={handleChange}
            isDark={isDark}
            lang={lang}
            minHeight={minHeight}
            onScroll={(percent) => {
              scrollPercentRef.current = percent;
            }}
            scrollToPercent={scrollPercentRef.current}
          />
        )}

        {mode === 'split' && (
          <div className="grid grid-cols-2 h-full divide-x divide-slate-200 dark:divide-slate-700">
            <Suspense fallback={<EditorLoading />}>
              <SourceEditor
                ref={sourceEditorRef}
                value={localValue}
                onChange={handleChange}
                isDark={isDark}
                placeholder={placeholder}
                className="h-full overflow-auto"
                onScroll={handleSourceScroll}
                onCursorChange={handleCursorChange}
                scrollToPercent={scrollPercentRef.current}
                cursorPos={cursorPos}
              />
            </Suspense>
            <div
              ref={previewRef}
              className="overflow-auto bg-slate-50 dark:bg-slate-900 px-6 py-4"
              style={{ height: '100%' }}
              onScroll={handlePreviewScroll}
            >
              <PreviewPanel content={localValue} lang={lang} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
        {mode === 'source' && (
          <span>
            {lang === 'zh' ? '快捷键' : 'Shortcuts'}: Ctrl+B {lang === 'zh' ? '粗体' : 'bold'}, Ctrl+I {lang === 'zh' ? '斜体' : 'italic'}, Ctrl+Z {lang === 'zh' ? '撤销' : 'undo'}, Ctrl+Shift+Z {lang === 'zh' ? '重做' : 'redo'}
          </span>
        )}
        {mode === 'wysiwyg' && (
          <span>
            {lang === 'zh' ? '即时渲染模式 - Typora 风格编辑体验' : 'Instant Rendering - Typora-like editing experience'}
          </span>
        )}
        {mode === 'split' && (
          <span>
            {lang === 'zh' ? '左侧编辑源码，右侧实时预览' : 'Edit source on left, preview on right'}
          </span>
        )}
      </div>

      <style>{`
        .vditor-container .vditor {
          border: none !important;
          border-radius: 0.75rem;
        }
        .vditor-container .vditor--dark {
          --panel-background-color: rgb(15 23 42);
          --toolbar-background-color: rgb(30 41 59);
        }
        .vditor-container .vditor-toolbar {
          border-radius: 0.75rem 0.75rem 0 0;
          padding: 8px 12px !important;
        }
        .vditor-container .vditor-content {
          border-radius: 0 0 0.75rem 0.75rem;
        }
        .vditor-container .vditor-reset {
          font-family: ui-sans-serif, system-ui, sans-serif !important;
        }
        .vditor-container .vditor-reset pre code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
        }
        .vditor-container .vditor-ir .vditor-reset {
          padding: 16px 20px;
        }
      `}</style>
    </div>
  );
}
