import { mapFingerprintToName, generateAvatarColor } from './nameMapper';

export interface Comment {
  id: number;
  author: string;
  authorColor: string;
  content: string;
  createdAt: string;
  postSlug: string;
  isAuthor?: boolean;
}

const STORAGE_KEY = 'blog_comments';

function getStoredComments(): Record<string, Comment[]> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveComments(comments: Record<string, Comment[]>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
  } catch {
    // localStorage not available
  }
}

export async function getComments(postSlug: string): Promise<Comment[]> {
  const allComments = getStoredComments();
  return allComments[postSlug] || [];
}

export async function submitComment(
  postSlug: string,
  content: string,
  fingerprint: string
): Promise<Comment> {
  const allComments = getStoredComments();
  const postComments = allComments[postSlug] || [];

  const newComment: Comment = {
    id: Date.now(),
    author: mapFingerprintToName(fingerprint),
    authorColor: generateAvatarColor(fingerprint),
    content,
    createdAt: new Date().toISOString(),
    postSlug,
  };

  postComments.push(newComment);
  allComments[postSlug] = postComments;
  saveComments(allComments);

  return newComment;
}

export async function deleteComment(postSlug: string, commentId: number): Promise<boolean> {
  const allComments = getStoredComments();
  const postComments = allComments[postSlug] || [];

  const index = postComments.findIndex(c => c.id === commentId);
  if (index === -1) return false;

  postComments.splice(index, 1);
  allComments[postSlug] = postComments;
  saveComments(allComments);

  return true;
}
