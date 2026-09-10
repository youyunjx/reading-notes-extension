import type { Note, SavedSource } from './types';
import { getNotes, getSources } from './storage';

export interface Backup {
  type: 'jot-backup';
  version: number;
  exportedAt: number;
  notes: Note[];
  sources: SavedSource[];
}

/** Build a full backup object from current storage. */
export async function buildBackup(): Promise<Backup> {
  const [notes, sources] = await Promise.all([getNotes(), getSources()]);
  return {
    type: 'jot-backup',
    version: 1,
    exportedAt: Date.now(),
    notes,
    sources,
  };
}

/**
 * Export a JSON backup of all notes + sources. Uses a "Save As" dialog so you
 * can store the file wherever you like (e.g. inside the project folder). Local
 * only — the JSON is built in-page and written via chrome.downloads.
 */
export async function exportBackup(): Promise<void> {
  const backup = await buildBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const filename = `jot-backup-${new Date().toISOString().slice(0, 10)}.json`;
  try {
    await chrome.downloads.download({ url, filename, saveAs: true });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

/**
 * Parse backup text into notes + sources. Accepts either our backup wrapper
 * ({ type, notes, sources }) or a bare { notes, sources } object.
 */
export function parseBackup(text: string): { notes: unknown[]; sources: unknown[] } {
  const data = JSON.parse(text) as Record<string, unknown>;
  const notes = Array.isArray(data.notes) ? data.notes : [];
  const sources = Array.isArray(data.sources) ? data.sources : [];
  return { notes, sources };
}
