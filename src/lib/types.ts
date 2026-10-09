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

/** Drawing tools available in the PDF viewer. `select` is the idle cursor. */
export type AnnotationTool = 'select' | 'text' | 'rect' | 'ellipse' | 'arrow';

export type AnnotationShape = Exclude<AnnotationTool, 'select'>;

/**
 * A drawn annotation on a PDF page.
 *
 * Geometry is normalised to 0–1 of the page's width/height so it is independent
 * of zoom and of the device pixel ratio. For `arrow`, (x, y) is the start point
 * and (w, h) is the delta to the end point, so w/h may be negative.
 */
export interface PdfAnnotation {
  id: string;
  /** The PDF this belongs to (the original file URL, not the viewer URL). */
  fileUrl: string;
  /** 1-based page number. */
  page: number;
  type: AnnotationShape;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Text content, for `text` annotations. */
  text?: string;
  /** Font size in PDF points (rendered at fontSize * zoom). */
  fontSize?: number;
  /** CSS hex colour, e.g. "#DC2626". */
  color: string;
  createdAt: number;
  updatedAt: number;
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

/** A single note: a quoted passage plus the user's own insight. */
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
