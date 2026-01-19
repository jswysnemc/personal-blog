import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface Props {
  children: string;
  displayMode?: boolean;
}

export default function MathBlock({ children, displayMode = true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      katex.render(children.trim(), containerRef.current, {
        displayMode,
        throwOnError: false,
        trust: true,
        strict: false,
        macros: {
          '\\R': '\\mathbb{R}',
          '\\N': '\\mathbb{N}',
          '\\Z': '\\mathbb{Z}',
          '\\Q': '\\mathbb{Q}',
          '\\C': '\\mathbb{C}',
        },
      });
    } catch (err) {
      console.error('KaTeX render error:', err);
      if (containerRef.current) {
        containerRef.current.innerHTML = `<span class="text-red-500">Math Error: ${err instanceof Error ? err.message : 'Unknown error'}</span>`;
      }
    }
  }, [children, displayMode]);

  if (displayMode) {
    return (
      <div className="math-block my-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <div ref={containerRef} className="flex justify-center text-slate-900 dark:text-slate-100" />
      </div>
    );
  }

  return (
    <span
      ref={containerRef}
      className="math-inline text-slate-900 dark:text-slate-100"
    />
  );
}

// Inline math component for use in text
export function InlineMath({ children }: { children: string }) {
  return <MathBlock displayMode={false}>{children}</MathBlock>;
}
