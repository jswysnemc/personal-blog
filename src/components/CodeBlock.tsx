import { useState, useEffect, useRef } from 'react';
import Prism from 'prismjs';

// Import common languages
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-docker';

interface Props {
  language?: string;
  children: string;
}

// Language aliases
const languageAliases: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  'c++': 'cpp',
  dockerfile: 'docker',
};

export default function CodeBlock({ language, children }: Props) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  const normalizedLang = language ? (languageAliases[language.toLowerCase()] || language.toLowerCase()) : 'plaintext';

  useEffect(() => {
    if (codeRef.current && normalizedLang !== 'plaintext') {
      Prism.highlightElement(codeRef.current);
    }
  }, [children, normalizedLang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const lines = children.split('\n');
  const showLineNumbers = lines.length > 1;
  const lineNumberWidth = String(lines.length).length;

  return (
    <div className="code-block group relative my-6 rounded-xl overflow-hidden shadow-sm">
      {/* Border gradient - Light/Dark */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-slate-200 via-slate-300 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 p-px">
        <div className="h-full w-full rounded-xl bg-[#fafbfc] dark:bg-[#161b22]" />
      </div>

      {/* Content container */}
      <div className="relative">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100 dark:bg-[#21262d] border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            {/* Terminal dots */}
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27ca40]" />
            </div>
            {/* Language badge */}
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono tracking-wide uppercase">
              {language || 'plaintext'}
            </span>
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400
                       hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700
                       rounded-md transition-all duration-200
                       focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            title="Copy code"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-600 dark:text-green-400">Copied</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Code content */}
        <div className="overflow-x-auto">
          <pre
            className="p-4 text-[13px] leading-6 m-0 bg-[#fafbfc] dark:bg-[#161b22]"
            style={{
              fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              tabSize: 2,
            }}
          >
            {showLineNumbers ? (
              <div className="table w-full">
                {lines.map((line, i) => (
                  <div key={i} className="table-row group/line">
                    <span
                      className="table-cell pr-4 text-right text-slate-400 dark:text-slate-600 select-none
                                 border-r border-slate-200 dark:border-slate-700
                                 group-hover/line:text-slate-500 dark:group-hover/line:text-slate-500 transition-colors"
                      style={{
                        width: `${lineNumberWidth + 1}ch`,
                        minWidth: '2.5rem',
                        userSelect: 'none',
                      }}
                    >
                      {i + 1}
                    </span>
                    <code
                      ref={i === 0 ? codeRef : undefined}
                      className={`table-cell pl-4 group-hover/line:bg-blue-50/50 dark:group-hover/line:bg-blue-900/20 transition-colors language-${normalizedLang}`}
                      style={{ whiteSpace: 'pre' }}
                      dangerouslySetInnerHTML={{
                        __html: normalizedLang !== 'plaintext' && Prism.languages[normalizedLang]
                          ? Prism.highlight(line || ' ', Prism.languages[normalizedLang], normalizedLang)
                          : escapeHtml(line || ' ')
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <code
                ref={codeRef}
                className={`language-${normalizedLang}`}
                style={{ whiteSpace: 'pre' }}
                dangerouslySetInnerHTML={{
                  __html: normalizedLang !== 'plaintext' && Prism.languages[normalizedLang]
                    ? Prism.highlight(children, Prism.languages[normalizedLang], normalizedLang)
                    : escapeHtml(children)
                }}
              />
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
