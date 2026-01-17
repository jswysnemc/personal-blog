interface Props {
  content: string;
  mentionUsers: Array<{ name: string; color: string }>;
}

export default function CommentContent({ content, mentionUsers }: Props) {
  // Create a map for quick user lookup
  const userMap = new Map(mentionUsers.map(u => [u.name, u.color]));

  // Split content by mentions and render
  const renderContent = () => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Regex to match @username (username can contain Chinese, letters, numbers)
    const mentionRegex = /@([\u4e00-\u9fa5\w]+)/g;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      const [fullMatch, username] = match;
      const matchIndex = match.index;

      // Add text before the mention
      if (matchIndex > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {content.slice(lastIndex, matchIndex)}
          </span>
        );
      }

      // Check if this is a valid user mention
      const userColor = userMap.get(username);
      if (userColor) {
        // Render as styled mention
        parts.push(
          <span
            key={`mention-${matchIndex}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md
                       bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium text-sm cursor-default
                       hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
            style={{
              borderLeft: `3px solid ${userColor}`,
            }}
          >
            <span className="text-blue-400 dark:text-blue-500">@</span>
            {username}
          </span>
        );
      } else {
        // Just render as plain text with @ styling
        parts.push(
          <span
            key={`mention-${matchIndex}`}
            className="text-blue-600 dark:text-blue-400 font-medium"
          >
            {fullMatch}
          </span>
        );
      }

      lastIndex = matchIndex + fullMatch.length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {content.slice(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? parts : content;
  };

  return (
    <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
      {renderContent()}
    </p>
  );
}
