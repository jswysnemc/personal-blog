import { useState, useEffect } from 'react';
import type { Lang } from '../lib/i18n';

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface Props {
  content: string;
  lang?: Lang;
}

export default function TableOfContents({ content, lang = 'zh' }: Props) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const lines = content.split('\n');
    const parsed: Heading[] = [];

    lines.forEach(line => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
          .replace(/^-|-$/g, '');

        if (level >= 2 && level <= 4) {
          parsed.push({ id, text, level });
        }
      }
    });

    setHeadings(parsed);
  }, [content]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-80px 0px -80% 0px' }
    );

    headings.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) {
    return null;
  }

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="sticky top-24">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-wide uppercase">
          {lang === 'zh' ? '目录' : 'On this page'}
        </h3>
      </div>

      {/* Progress line container */}
      <div className="relative">
        {/* Background line */}
        <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />

        {/* Active indicator */}
        <div
          className="absolute left-0 w-px bg-blue-500 dark:bg-blue-400 transition-all duration-300 ease-out"
          style={{
            top: `${(headings.findIndex(h => h.id === activeId) / headings.length) * 100}%`,
            height: `${100 / headings.length}%`,
          }}
        />

        {/* Heading links */}
        <ul className="space-y-1 pl-4">
          {headings.map(({ id, text, level }) => {
            const isActive = activeId === id;
            return (
              <li
                key={id}
                style={{ paddingLeft: `${(level - 2) * 0.75}rem` }}
              >
                <button
                  onClick={() => handleClick(id)}
                  className={`
                    text-left w-full text-sm py-1.5 transition-all duration-200
                    hover:text-slate-900 dark:hover:text-white
                    ${isActive
                      ? 'text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-slate-500 dark:text-slate-400'
                    }
                  `}
                >
                  <span className="line-clamp-2">{text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Scroll to top button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="mt-6 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors group"
      >
        <svg className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        {lang === 'zh' ? '回到顶部' : 'Back to top'}
      </button>
    </nav>
  );
}
