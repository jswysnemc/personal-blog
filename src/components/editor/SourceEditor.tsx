import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, highlightActiveLine } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, HighlightStyle } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { tags } from '@lezer/highlight';

export interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  isDark?: boolean;
  className?: string;
  placeholder?: string;
  onScroll?: (scrollPercent: number) => void;
  scrollToPercent?: number;
  onCursorChange?: (pos: number) => void;
  cursorPos?: number;
}

export interface SourceEditorHandle {
  scrollToPercent: (scrollPercent: number) => void;
}

const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: 'rgb(248 250 252)',
    height: '100%',
  },
  '.cm-content': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '14px',
    lineHeight: '1.7',
    padding: '16px',
    caretColor: '#1e293b',
  },
  '.cm-line': {
    padding: '0 4px',
  },
  '.cm-gutters': {
    backgroundColor: 'rgb(248 250 252)',
    color: '#94a3b8',
    border: 'none',
    paddingRight: '8px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgb(241 245 249)',
    color: '#475569',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgb(241 245 249)',
  },
  '.cm-cursor': {
    borderLeftColor: '#1e293b',
    borderLeftWidth: '2px',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgb(199 210 254) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgb(199 210 254) !important',
  },
  '.cm-placeholder': {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
});

const darkThemeExtension = EditorView.theme({
  '&': {
    backgroundColor: 'rgb(15 23 42)',
    height: '100%',
  },
  '.cm-content': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '14px',
    lineHeight: '1.7',
    padding: '16px',
    caretColor: '#f1f5f9',
  },
  '.cm-line': {
    padding: '0 4px',
  },
  '.cm-gutters': {
    backgroundColor: 'rgb(15 23 42)',
    color: '#64748b',
    border: 'none',
    paddingRight: '8px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgb(30 41 59)',
    color: '#94a3b8',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgb(30 41 59)',
  },
  '.cm-cursor': {
    borderLeftColor: '#f1f5f9',
    borderLeftWidth: '2px',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'rgb(51 65 85) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgb(51 65 85) !important',
  },
  '.cm-placeholder': {
    color: '#64748b',
    fontStyle: 'italic',
  },
});

const markdownHighlighting = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: 'bold', fontSize: '1.4em', color: '#1e293b' },
  { tag: tags.heading2, fontWeight: 'bold', fontSize: '1.3em', color: '#334155' },
  { tag: tags.heading3, fontWeight: 'bold', fontSize: '1.2em', color: '#475569' },
  { tag: tags.heading4, fontWeight: 'bold', fontSize: '1.1em', color: '#475569' },
  { tag: tags.strong, fontWeight: 'bold', color: '#1e293b' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#475569' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#94a3b8' },
  { tag: tags.link, color: '#2563eb', textDecoration: 'underline' },
  { tag: tags.url, color: '#64748b' },
  { tag: tags.monospace, fontFamily: 'monospace', backgroundColor: 'rgb(241 245 249)', padding: '2px 4px', borderRadius: '4px' },
  { tag: tags.quote, color: '#64748b', fontStyle: 'italic', borderLeft: '3px solid #e2e8f0', paddingLeft: '12px' },
  { tag: tags.list, color: '#3b82f6' },
  { tag: tags.meta, color: '#94a3b8' },
  { tag: tags.processingInstruction, color: '#8b5cf6' },
]);

const markdownHighlightingDark = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: 'bold', fontSize: '1.4em', color: '#f1f5f9' },
  { tag: tags.heading2, fontWeight: 'bold', fontSize: '1.3em', color: '#e2e8f0' },
  { tag: tags.heading3, fontWeight: 'bold', fontSize: '1.2em', color: '#cbd5e1' },
  { tag: tags.heading4, fontWeight: 'bold', fontSize: '1.1em', color: '#cbd5e1' },
  { tag: tags.strong, fontWeight: 'bold', color: '#f1f5f9' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#94a3b8' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#64748b' },
  { tag: tags.link, color: '#60a5fa', textDecoration: 'underline' },
  { tag: tags.url, color: '#94a3b8' },
  { tag: tags.monospace, fontFamily: 'monospace', backgroundColor: 'rgb(30 41 59)', padding: '2px 4px', borderRadius: '4px' },
  { tag: tags.quote, color: '#94a3b8', fontStyle: 'italic', borderLeft: '3px solid #334155', paddingLeft: '12px' },
  { tag: tags.list, color: '#60a5fa' },
  { tag: tags.meta, color: '#64748b' },
  { tag: tags.processingInstruction, color: '#a78bfa' },
]);

const SourceEditor = forwardRef<SourceEditorHandle, SourceEditorProps>(function SourceEditor({
  value,
  onChange,
  isDark = false,
  className = '',
  placeholder,
  onScroll,
  scrollToPercent,
  onCursorChange,
  cursorPos,
}: SourceEditorProps, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isUpdating = useRef(false);
  const isProgrammaticScroll = useRef(false);
  const onScrollRef = useRef(onScroll);
  const onCursorChangeRef = useRef(onCursorChange);

  useEffect(() => {
    onScrollRef.current = onScroll;
  }, [onScroll]);

  useEffect(() => {
    onCursorChangeRef.current = onCursorChange;
  }, [onCursorChange]);

  const scrollToPercentInternal = useCallback((percent: number) => {
    if (!viewRef.current) return;
    const scroller = viewRef.current.scrollDOM;
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    const targetScroll = maxScroll * percent;
    if (Math.abs(scroller.scrollTop - targetScroll) > 1) {
      isProgrammaticScroll.current = true;
      scroller.scrollTop = targetScroll;
      requestAnimationFrame(() => {
        isProgrammaticScroll.current = false;
      });
    }
  }, []);

  useImperativeHandle(ref, () => ({
    scrollToPercent: scrollToPercentInternal,
  }), [scrollToPercentInternal]);

  const handleUpdate = useCallback((update: { state: EditorState }) => {
    if (!isUpdating.current) {
      const newValue = update.state.doc.toString();
      onChange(newValue);
    }
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      highlightActiveLine(),
      history(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        indentWithTab,
      ]),
      markdown({
        base: markdownLanguage,
      }),
      isDark
        ? [darkThemeExtension, syntaxHighlighting(markdownHighlightingDark), oneDark]
        : [lightTheme, syntaxHighlighting(markdownHighlighting), syntaxHighlighting(defaultHighlightStyle)],
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          handleUpdate(update);
        }
        if (update.selectionSet && onCursorChangeRef.current) {
          const pos = update.state.selection.main.head;
          onCursorChangeRef.current(pos);
        }
      }),
      EditorView.lineWrapping,
      EditorView.domEventHandlers({
        scroll: (event) => {
          if (isProgrammaticScroll.current) return false;
          if (onScrollRef.current) {
            const target = event.target as HTMLElement;
            const scrollTop = target.scrollTop;
            const scrollHeight = target.scrollHeight - target.clientHeight;
            const scrollPercent = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
            onScrollRef.current(scrollPercent);
          }
          return false;
        },
      }),
    ];

    if (placeholder) {
      extensions.push(
        EditorView.contentAttributes.of({ 'aria-placeholder': placeholder })
      );
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Apply initial scroll position after view is ready
    if (scrollToPercent !== undefined && scrollToPercent > 0) {
      requestAnimationFrame(() => {
        scrollToPercentInternal(scrollToPercent);
      });
    }

    // Apply initial cursor position
    if (cursorPos !== undefined && cursorPos > 0 && cursorPos <= view.state.doc.length) {
      view.dispatch({
        selection: { anchor: cursorPos },
      });
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [isDark]);

  useEffect(() => {
    if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
      isUpdating.current = true;
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value,
        },
      });
      isUpdating.current = false;
    }
  }, [value]);

  // Scroll to percent when prop changes
  useEffect(() => {
    if (viewRef.current && scrollToPercent !== undefined) {
      scrollToPercentInternal(scrollToPercent);
    }
  }, [scrollToPercent, scrollToPercentInternal]);

  // Set cursor position when prop changes
  useEffect(() => {
    if (viewRef.current && cursorPos !== undefined) {
      const currentPos = viewRef.current.state.selection.main.head;
      if (currentPos !== cursorPos && cursorPos <= viewRef.current.state.doc.length) {
        viewRef.current.dispatch({
          selection: { anchor: cursorPos },
        });
      }
    }
  }, [cursorPos]);

  return (
    <div
      ref={containerRef}
      className={`source-editor overflow-auto ${className}`}
    />
  );
});

export default SourceEditor;
