import { useState } from 'react';

interface Props {
  onInsert: (text: string, cursorOffset?: number) => void;
  lang?: 'zh' | 'en';
}

export default function MarkdownToolbar({ onInsert, lang = 'zh' }: Props) {
  const [showHelp, setShowHelp] = useState(false);

  const tools = [
    {
      icon: 'H1',
      label: lang === 'zh' ? '标题' : 'Heading',
      action: () => onInsert('# ', 0),
    },
    {
      icon: 'B',
      label: lang === 'zh' ? '粗体' : 'Bold',
      action: () => onInsert('**文本**', -3),
      shortcut: 'Ctrl+B',
    },
    {
      icon: 'I',
      label: lang === 'zh' ? '斜体' : 'Italic',
      action: () => onInsert('*文本*', -2),
      shortcut: 'Ctrl+I',
    },
    {
      icon: '</>',
      label: lang === 'zh' ? '代码' : 'Code',
      action: () => onInsert('`code`', -1),
    },
    {
      icon: '{}',
      label: lang === 'zh' ? '代码块' : 'Code Block',
      action: () => onInsert('```javascript\n\n```', -4),
    },
    {
      icon: 'svg:link',
      label: lang === 'zh' ? '链接' : 'Link',
      action: () => onInsert('[链接文本](url)', -1),
    },
    {
      icon: 'svg:image',
      label: lang === 'zh' ? '图片' : 'Image',
      action: () => onInsert('![图片描述](url)', -1),
    },
    {
      icon: 'svg:list',
      label: lang === 'zh' ? '列表' : 'List',
      action: () => onInsert('- 列表项\n- 列表项', 0),
    },
    {
      icon: '1.',
      label: lang === 'zh' ? '有序列表' : 'Ordered List',
      action: () => onInsert('1. 列表项\n2. 列表项', 0),
    },
    {
      icon: 'svg:quote',
      label: lang === 'zh' ? '引用' : 'Quote',
      action: () => onInsert('> 引用内容', 0),
    },
    {
      icon: '---',
      label: lang === 'zh' ? '分隔线' : 'Divider',
      action: () => onInsert('\n---\n', 0),
    },
    {
      icon: 'svg:check',
      label: lang === 'zh' ? '任务列表' : 'Task',
      action: () => onInsert('- [ ] 任务项\n- [x] 已完成', 0),
    },
  ];

  return (
    <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-1 flex-wrap">
          {tools.map((tool, idx) => (
            <button
              key={idx}
              onClick={tool.action}
              className="group relative px-2.5 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400
                         hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700
                         rounded-lg transition-colors"
              title={tool.label + (tool.shortcut ? ` (${tool.shortcut})` : '')}
            >
              {tool.icon.startsWith('svg:') ? (
                <span className="inline-block w-4 h-4">
                  {tool.icon === 'svg:link' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  )}
                  {tool.icon === 'svg:image' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  {tool.icon === 'svg:list' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                  {tool.icon === 'svg:quote' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  )}
                  {tool.icon === 'svg:check' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  )}
                </span>
              ) : (
                <span className="font-mono">{tool.icon}</span>
              )}
              {/* Tooltip */}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs
                             bg-slate-900 dark:bg-slate-700 text-white rounded whitespace-nowrap
                             opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {tool.label}
                {tool.shortcut && <span className="ml-1 text-slate-400">({tool.shortcut})</span>}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white
                     hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          {lang === 'zh' ? '语法帮助' : 'Help'}
        </button>
      </div>

      {showHelp && (
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700
                        text-xs text-slate-600 dark:text-slate-400 space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div><code className="text-blue-600 dark:text-blue-400"># 标题</code> - {lang === 'zh' ? '一级标题' : 'H1'}</div>
            <div><code className="text-blue-600 dark:text-blue-400">## 标题</code> - {lang === 'zh' ? '二级标题' : 'H2'}</div>
            <div><code className="text-blue-600 dark:text-blue-400">**文本**</code> - {lang === 'zh' ? '粗体' : 'Bold'}</div>
            <div><code className="text-blue-600 dark:text-blue-400">*文本*</code> - {lang === 'zh' ? '斜体' : 'Italic'}</div>
            <div><code className="text-blue-600 dark:text-blue-400">`代码`</code> - {lang === 'zh' ? '行内代码' : 'Inline code'}</div>
            <div><code className="text-blue-600 dark:text-blue-400">[文本](url)</code> - {lang === 'zh' ? '链接' : 'Link'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
