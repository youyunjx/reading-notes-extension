import type { Citation } from './types';

export function emptyCitation(): Citation {
  return {
    author: '',
    editor: '',
    bookName: '',
    chapter: '',
    page: '',
    publisher: '',
    year: '',
  };
}

/** True if any citation field has been filled in. */
export function citationHasData(c?: Citation | null): boolean {
  return !!c && Object.values(c).some((v) => v.trim() !== '');
}

/** A short label for a saved source, used in the "apply source" dropdown. */
export function sourceLabel(c: Citation): string {
  const book = c.bookName.trim();
  const author = c.author.trim();
  if (book && author) return `${book} — ${author}`;
  return book || author || 'Untitled source';
}

/** Human-readable one-line citation for display, joining only filled fields. */
export function formatCitation(c: Citation): string {
  const parts: string[] = [];
  const author = c.author.trim();
  const year = c.year.trim();
  if (author) parts.push(year ? `${author} (${year})` : author);
  else if (year) parts.push(`(${year})`);
  if (c.bookName.trim()) parts.push(c.bookName.trim());
  if (c.editor.trim()) parts.push(`ed. ${c.editor.trim()}`);

  const loc: string[] = [];
  if (c.chapter.trim()) loc.push(`ch. ${c.chapter.trim()}`);
  if (c.page.trim()) loc.push(`p. ${c.page.trim()}`);
  if (loc.length) parts.push(loc.join(', '));

  if (c.publisher.trim()) parts.push(c.publisher.trim());
  return parts.join('. ');
}

/**
 * Merge the reusable book-level fields of a saved source into a citation,
 * preserving the per-note chapter and page already entered.
 */
export function applySourceToCitation(current: Citation, source: Citation): Citation {
  return {
    ...current,
    author: source.author,
    editor: source.editor,
    bookName: source.bookName,
    publisher: source.publisher,
    year: source.year,
  };
}

/** Identity key over the book-level fields, for de-duplicating saved sources. */
export function bookLevelKey(c: Citation): string {
  return [c.author, c.editor, c.bookName, c.publisher, c.year]
    .map((s) => s.trim().toLowerCase())
    .join('|');
}
