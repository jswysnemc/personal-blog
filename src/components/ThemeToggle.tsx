'use client';

import { useState, useEffect } from 'react';
import { type Theme, getStoredTheme, setStoredTheme, applyTheme } from '../lib/theme';

interface Props {
  className?: string;
}

export default function ThemeToggle({ className = '' }: Props) {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(getStoredTheme());
  }, []);

  const cycleTheme = () => {
    const themes: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];

    setTheme(nextTheme);
    setStoredTheme(nextTheme);
    applyTheme(nextTheme);
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <button
        className={`p-2 rounded-lg bg-slate-100 dark:bg-slate-800 ${className}`}
        aria-label="Toggle theme"
      >
        <div className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={cycleTheme}
      className={`p-2 rounded-lg transition-colors
                  bg-slate-100 hover:bg-slate-200
                  dark:bg-slate-800 dark:hover:bg-slate-700
                  text-slate-600 dark:text-slate-400 ${className}`}
      aria-label={`Current theme: ${theme}. Click to change.`}
      title={theme === 'system' ? 'System theme' : theme === 'dark' ? 'Dark theme' : 'Light theme'}
    >
      {/* Sun icon - shown in light mode */}
      {theme === 'light' && (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      )}

      {/* Moon icon - shown in dark mode */}
      {theme === 'dark' && (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}

      {/* System icon - shown in system mode */}
      {theme === 'system' && (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}
