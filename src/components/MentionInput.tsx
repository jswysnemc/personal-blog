import { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  mentionUsers: Array<{ name: string; color: string }>;
  className?: string;
  rows?: number;
}

export default function MentionInput({
  value,
  onChange,
  placeholder,
  maxLength = 2000,
  mentionUsers,
  className = '',
  rows = 4,
}: Props) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filter users based on query
  const filteredUsers = mentionUsers.filter(user =>
    user.name.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  // Handle text change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    onChange(newValue);

    // Check if we're in a mention context
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Check if there's no space after @ (still typing mention)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionStart(lastAtIndex);
        setMentionQuery(textAfterAt);
        setShowSuggestions(true);
        setSuggestionIndex(0);
        return;
      }
    }

    setShowSuggestions(false);
    setMentionStart(-1);
    setMentionQuery('');
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || filteredUsers.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSuggestionIndex(prev =>
          prev < filteredUsers.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSuggestionIndex(prev =>
          prev > 0 ? prev - 1 : filteredUsers.length - 1
        );
        break;
      case 'Enter':
        if (showSuggestions) {
          e.preventDefault();
          selectUser(filteredUsers[suggestionIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        break;
      case 'Tab':
        if (showSuggestions) {
          e.preventDefault();
          selectUser(filteredUsers[suggestionIndex]);
        }
        break;
    }
  };

  // Select a user for mention
  const selectUser = useCallback((user: { name: string; color: string }) => {
    if (mentionStart === -1) return;

    const beforeMention = value.slice(0, mentionStart);
    const afterMention = value.slice(mentionStart + 1 + mentionQuery.length);
    const newValue = `${beforeMention}@${user.name} ${afterMention}`;

    onChange(newValue);
    setShowSuggestions(false);
    setMentionStart(-1);
    setMentionQuery('');

    // Focus and set cursor position
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStart + user.name.length + 2; // +2 for @ and space
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [value, mentionStart, mentionQuery, onChange]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll active suggestion into view
  useEffect(() => {
    if (showSuggestions && suggestionsRef.current) {
      const activeItem = suggestionsRef.current.querySelector('[data-active="true"]');
      activeItem?.scrollIntoView({ block: 'nearest' });
    }
  }, [suggestionIndex, showSuggestions]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className={className}
      />

      {/* Mention suggestions dropdown */}
      {showSuggestions && filteredUsers.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg dark:shadow-slate-900/50
                     max-h-48 overflow-y-auto z-50"
        >
          {filteredUsers.map((user, index) => (
            <button
              key={user.name}
              type="button"
              data-active={index === suggestionIndex}
              onClick={() => selectUser(user)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                         ${index === suggestionIndex ? 'bg-blue-50 dark:bg-blue-900/40' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0"
                style={{ backgroundColor: user.color }}
              >
                {user.name.charAt(0)}
              </div>
              <span className="font-medium text-slate-700 dark:text-slate-200">{user.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* No matches message */}
      {showSuggestions && filteredUsers.length === 0 && mentionQuery.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg dark:shadow-slate-900/50 p-4 z-50"
        >
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">No users found</p>
        </div>
      )}
    </div>
  );
}
