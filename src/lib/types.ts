/** A source a note was captured from. */
export interface NoteSource {
  url: string;
  title: string;
  faviconUrl?: string;
  /** 1-based page number, when the note came from a PDF. Used to re-anchor the
   *  highlight when the PDF is reopened. */
  pdfPage?: number;
}

/**
 * Bibliographic details for a note. `chapter` and `page` vary per note; the
 * remaining fields (author, editor, book name, publisher, year) are book-level
 * and are what gets stored as a reusable {@link SavedSource}.
 */
export interface Citation {
  author: string;
  editor: string;
  bookName: string;
  chapter: string;
  page: string;
  publisher: string;
  year: string;
}

/** A request (from an on-page marker) to focus a specific note in the side panel. */
export interface FocusRequest {
  noteId: string;
  sourceKey: string;
  at: number;
}

/** A reusable book-level citation the user can apply to many notes. */
export interface SavedSource {
  id: string;
  /** Book-level citation fields (chapter/page left blank). */
  citation: Citation;
  createdAt: number;
}

/** A single reading note: a quoted passage plus the user's own insight. */
export interface Note {
  id: string;
  /** The selected text captured from the page. */
  quote: string;
  /** The user's own words / insight about the quote. */
  insight: string;
  source: NoteSource;
  /** Optional bibliographic citation. */
  citation?: Citation;
  createdAt: number;
  updatedAt: number;
}

/** Fields supplied when creating a new note; the rest are generated. */
export type NewNoteInput = {
  quote: string;
  insight: string;
  source: NoteSource;
  citation?: Citation;
};

/**
 * A quote captured via the right-click context menu, awaiting an insight. Held
 * in session storage until the side panel turns it into a saved note (or the
 * user cancels).
 */
export interface PendingCapture {
  quote: string;
  source: NoteSource;
  /** Capture timestamp; also used to key/reset the compose form. */
  at: number;
}
