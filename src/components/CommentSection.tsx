import { useState, useEffect } from 'react';
import { getComments, submitComment, deleteComment, type Comment } from '../lib/comments';
import { generateFingerprint } from '../lib/fingerprint';
import { mapFingerprintToName, generateAvatarColor } from '../lib/nameMapper';
import { isAdminLoggedIn } from '../lib/auth';
import { ui, type Lang } from '../lib/i18n';

interface Props {
  postSlug: string;
  lang?: Lang;
}

export default function CommentSection({ postSlug, lang = 'zh' }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [visitorName, setVisitorName] = useState('');
  const [visitorColor, setVisitorColor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fingerprint, setFingerprint] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const t = (key: keyof typeof ui.zh) => ui[lang][key] || ui.zh[key];

  useEffect(() => {
    async function init() {
      const fp = await generateFingerprint();
      setFingerprint(fp);
      setVisitorName(mapFingerprintToName(fp));
      setVisitorColor(generateAvatarColor(fp));

      const data = await getComments(postSlug);
      setComments(data);

      setIsAdmin(isAdminLoggedIn());
    }

    init();
  }, [postSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const comment = await submitComment(postSlug, newComment.trim(), fingerprint);
      setComments(prev => [...prev, comment]);
      setNewComment('');
    } catch (error) {
      console.error('Failed to submit comment:', error);
    }

    setIsSubmitting(false);
  };

  const handleDelete = async (commentId: number) => {
    if (!isAdmin) return;

    const success = await deleteComment(postSlug, commentId);
    if (success) {
      setComments(prev => prev.filter(c => c.id !== commentId));
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <section className="mt-16 pt-8 border-t border-gray-200">
      <h2 className="text-2xl font-semibold mb-8">{t('comment.title')}</h2>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          {t('comment.identity')}
          <span
            className="ml-2 font-medium"
            style={{ color: visitorColor }}
          >
            {visitorName}
          </span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mb-8">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t('comment.placeholder')}
          className="w-full p-4 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={4}
          maxLength={2000}
        />
        <div className="flex justify-between items-center mt-3">
          <span className="text-sm text-gray-500">
            {newComment.length}/2000
          </span>
          <button
            type="submit"
            disabled={isSubmitting || !newComment.trim()}
            className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? t('comment.submitting') : t('comment.submit')}
          </button>
        </div>
      </form>

      <div className="space-y-6">
        {comments.map(comment => (
          <article key={comment.id} className="flex gap-4">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium shrink-0"
              style={{ backgroundColor: comment.authorColor }}
            >
              {comment.author.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium" style={{ color: comment.authorColor }}>
                  {comment.author}
                </span>
                <time className="text-sm text-gray-500">
                  {formatDate(comment.createdAt)}
                </time>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="ml-auto text-sm text-red-500 hover:text-red-700"
                  >
                    {t('comment.delete')}
                  </button>
                )}
              </div>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>
          </article>
        ))}

        {comments.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            {t('comment.empty')}
          </p>
        )}
      </div>
    </section>
  );
}
