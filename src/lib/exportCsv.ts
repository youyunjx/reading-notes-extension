import type { Note } from './types';
import { notesToCsv } from './csv';

/** File name like `jot-notes-2026-07-15.csv`. */
function csvFileName(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `jot-notes-${date}.csv`;
}

/**
 * Export all notes to a CSV file, then open the folder it was saved in.
 *
 * Uses the local `chrome.downloads` API — the file is written to the browser's
 * Downloads folder and `downloads.show` opens the OS file manager highlighting
 * it. No network is involved (the CSV is built in-page from a Blob URL).
 *
 * Resolves once the download has started and the folder has been opened.
 */
export async function exportNotesToCsv(notes: Note[]): Promise<void> {
  const csv = notesToCsv(notes);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  try {
    const downloadId = await chrome.downloads.download({
      url,
      filename: csvFileName(),
      saveAs: false,
    });
    // Open the containing directory in the OS file explorer.
    chrome.downloads.show(downloadId);
  } finally {
    // Give the download time to read the Blob before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
