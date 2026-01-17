export interface DraftPost {
  id: string;
  title: string;
  description: string;
  category: 'tech' | 'life' | 'thoughts' | 'tutorial' | 'reading';
  tags: string[];
  content: string;
  createdAt: string;
  updatedAt: string;
}

const DRAFTS_KEY = 'blog_drafts';

export function getDrafts(): DraftPost[] {
  try {
    const stored = localStorage.getItem(DRAFTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveDraft(draft: DraftPost): void {
  const drafts = getDrafts();
  const index = drafts.findIndex(d => d.id === draft.id);

  if (index >= 0) {
    drafts[index] = { ...draft, updatedAt: new Date().toISOString() };
  } else {
    drafts.push(draft);
  }

  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

export function deleteDraft(id: string): void {
  const drafts = getDrafts().filter(d => d.id !== id);
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

export function createNewDraft(): DraftPost {
  return {
    id: Date.now().toString(),
    title: '',
    description: '',
    category: 'tech',
    tags: [],
    content: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function generateMarkdown(draft: DraftPost): string {
  const slug = draft.title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '');

  const frontmatter = `---
title: "${draft.title}"
description: "${draft.description}"
pubDate: ${new Date().toISOString().split('T')[0]}
category: ${draft.category}
tags: [${draft.tags.map(t => `"${t}"`).join(', ')}]
draft: false
---

${draft.content}`;

  return frontmatter;
}

export function downloadMarkdown(draft: DraftPost): void {
  const content = generateMarkdown(draft);
  const slug = draft.title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '') || 'untitled';

  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
