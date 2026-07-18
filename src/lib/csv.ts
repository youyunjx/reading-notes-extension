import type { Note } from './types';

const COLUMNS = [
  'Quote',
  'Insight',
  'Author',
  'Editor',
  'Book Name',
  'Chapter',
  'Page',
  'Publisher',
  'Year',
  'Source Title',
  'Source URL',
  'Created At',
  'Updated At',
] as const;

/** UTF-8 byte-order mark, so Excel opens non-ASCII text (accents, CJK, emoji)
 *  correctly instead of mojibake. */
const BOM = '﻿';

/** Escape a single CSV cell (RFC 4180): wrap in quotes if it contains a comma,
 *  quote, or newline, and double any embedded quotes. */
function escapeCell(value: string): string {
  const v = value ?? '';
  if (/[",\r\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** Serialize notes to a CSV string. Rows use CRLF line endings. */
export function notesToCsv(notes: Note[]): string {
  const rows: string[][] = [
    [...COLUMNS],
    ...notes.map((n) => [
      n.quote,
      n.insight,
      n.citation?.author ?? '',
      n.citation?.editor ?? '',
      n.citation?.bookName ?? '',
      n.citation?.chapter ?? '',
      n.citation?.page ?? '',
      n.citation?.publisher ?? '',
      n.citation?.year ?? '',
      n.source.title,
      n.source.url,
      new Date(n.createdAt).toISOString(),
      new Date(n.updatedAt).toISOString(),
    ]),
  ];
  const body = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
  return BOM + body;
}
