import type {
  Note,
  NewNoteInput,
  PendingCapture,
  SavedSource,
  Citation,
} from './types';
import { citationHasData, sourceLabel, bookLevelKey } from './citation';

const STORAGE_KEY = 'notes';
const PENDING_KEY = 'pendingCapture';
const SOURCES_KEY = 'sources';

/** Read all notes, newest first. */
export async function getNotes(): Promise<Note[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const notes = (result[STORAGE_KEY] as Note[] | undefined) ?? [];
  return [...notes].sort((a, b) => b.createdAt - a.createdAt);
}

async function writeNotes(notes: Note[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: notes });
}

function newId(): string {
  // crypto.randomUUID is available in service workers, content scripts, and pages.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Create and persist a new note. Returns the created note. */
export async function addNote(input: NewNoteInput): Promise<Note> {
  const now = Date.now();
  const note: Note = {
    id: newId(),
    quote: input.quote.trim(),
    insight: input.insight.trim(),
    source: input.source,
    ...(citationHasData(input.citation) ? { citation: input.citation } : {}),
    createdAt: now,
    updatedAt: now,
  };
  const notes = await getRaw();
  notes.push(note);
  await writeNotes(notes);
  return note;
}

/** Update the mutable fields (quote/insight/citation) of an existing note. */
export async function updateNote(
  id: string,
  patch: Partial<Pick<Note, 'quote' | 'insight' | 'citation'>>,
): Promise<void> {
  const notes = await getRaw();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return;
  const updated: Note = {
    ...notes[idx],
    ...('quote' in patch ? { quote: (patch.quote ?? '').trim() } : {}),
    ...('insight' in patch ? { insight: (patch.insight ?? '').trim() } : {}),
    updatedAt: Date.now(),
  };
  if ('citation' in patch) {
    if (citationHasData(patch.citation)) {
      updated.citation = patch.citation;
    } else {
      delete updated.citation;
    }
  }
  notes[idx] = updated;
  await writeNotes(notes);
}

/** Delete a note by id. */
export async function deleteNote(id: string): Promise<void> {
  const notes = await getRaw();
  await writeNotes(notes.filter((n) => n.id !== id));
}

/** Raw (unsorted) read used internally so writes preserve insertion order. */
async function getRaw(): Promise<Note[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as Note[] | undefined) ?? [];
}

/**
 * Subscribe to changes in the notes collection. Fires the callback with the
 * latest notes (newest first) whenever storage changes. Returns an unsubscribe.
 */
export function subscribeNotes(callback: (notes: Note[]) => void): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ) => {
    if (areaName !== 'local' || !(STORAGE_KEY in changes)) return;
    const notes = (changes[STORAGE_KEY].newValue as Note[] | undefined) ?? [];
    callback([...notes].sort((a, b) => b.createdAt - a.createdAt));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// --- Pending capture (context-menu → side-panel compose flow) ---
// Stored in session storage so it doesn't outlive the browsing session and never
// pollutes the saved notes if the user cancels.

export async function setPendingCapture(capture: PendingCapture): Promise<void> {
  await chrome.storage.session.set({ [PENDING_KEY]: capture });
}

export async function getPendingCapture(): Promise<PendingCapture | null> {
  const result = await chrome.storage.session.get(PENDING_KEY);
  return (result[PENDING_KEY] as PendingCapture | undefined) ?? null;
}

export async function clearPendingCapture(): Promise<void> {
  await chrome.storage.session.remove(PENDING_KEY);
}

/** Subscribe to pending-capture changes (fires with the new value or null). */
export function subscribePendingCapture(
  callback: (capture: PendingCapture | null) => void,
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ) => {
    if (areaName !== 'session' || !(PENDING_KEY in changes)) return;
    callback((changes[PENDING_KEY].newValue as PendingCapture | undefined) ?? null);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// --- Reusable sources (book-level citations) ---

async function getRawSources(): Promise<SavedSource[]> {
  const result = await chrome.storage.local.get(SOURCES_KEY);
  return (result[SOURCES_KEY] as SavedSource[] | undefined) ?? [];
}

async function writeSources(sources: SavedSource[]): Promise<void> {
  await chrome.storage.local.set({ [SOURCES_KEY]: sources });
}

/** All saved sources, sorted by their display label. */
export async function getSources(): Promise<SavedSource[]> {
  const sources = await getRawSources();
  return [...sources].sort((a, b) =>
    sourceLabel(a.citation).localeCompare(sourceLabel(b.citation)),
  );
}

/**
 * Save a citation's book-level fields as a reusable source. If a source with the
 * same book-level fields already exists it is returned unchanged (no duplicate).
 */
export async function saveSource(citation: Citation): Promise<SavedSource> {
  const bookLevel: Citation = { ...citation, chapter: '', page: '' };
  const sources = await getRawSources();
  const key = bookLevelKey(bookLevel);
  const existing = sources.find((s) => bookLevelKey(s.citation) === key);
  if (existing) return existing;

  const source: SavedSource = {
    id: newId(),
    citation: bookLevel,
    createdAt: Date.now(),
  };
  sources.push(source);
  await writeSources(sources);
  return source;
}

/** Delete a saved source by id. */
export async function deleteSource(id: string): Promise<void> {
  const sources = await getRawSources();
  await writeSources(sources.filter((s) => s.id !== id));
}

/** Subscribe to saved-source changes (fires with the latest sorted list). */
export function subscribeSources(callback: (sources: SavedSource[]) => void): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ) => {
    if (areaName !== 'local' || !(SOURCES_KEY in changes)) return;
    const sources = (changes[SOURCES_KEY].newValue as SavedSource[] | undefined) ?? [];
    callback(
      [...sources].sort((a, b) =>
        sourceLabel(a.citation).localeCompare(sourceLabel(b.citation)),
      ),
    );
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// --- Import / restore from a backup file ---

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function sanitizeCitation(c: unknown): Citation | undefined {
  if (!c || typeof c !== 'object') return undefined;
  const r = c as Record<string, unknown>;
  const citation: Citation = {
    author: str(r.author),
    editor: str(r.editor),
    bookName: str(r.bookName),
    chapter: str(r.chapter),
    page: str(r.page),
    publisher: str(r.publisher),
    year: str(r.year),
  };
  return citationHasData(citation) ? citation : undefined;
}

function sanitizeNote(raw: unknown): Note | null {
  if (!raw || typeof raw !== 'object') return null;
  const n = raw as Record<string, unknown>;
  if (typeof n.id !== 'string') return null;
  const src = (n.source && typeof n.source === 'object' ? n.source : {}) as Record<string, unknown>;
  const note: Note = {
    id: n.id,
    quote: str(n.quote),
    insight: str(n.insight),
    source: {
      url: str(src.url),
      title: str(src.title),
      ...(typeof src.faviconUrl === 'string' ? { faviconUrl: src.faviconUrl } : {}),
    },
    createdAt: typeof n.createdAt === 'number' ? n.createdAt : Date.now(),
    updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : Date.now(),
  };
  const citation = sanitizeCitation(n.citation);
  if (citation) note.citation = citation;
  return note;
}

function sanitizeSource(raw: unknown): SavedSource | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== 'string') return null;
  const citation = sanitizeCitation(s.citation);
  if (!citation) return null;
  return {
    id: s.id,
    citation,
    createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
  };
}

/**
 * Merge notes/sources from a backup into storage. Existing items are kept;
 * only items whose id isn't already present are added (safe to run twice).
 */
export async function importData(incoming: {
  notes?: unknown[];
  sources?: unknown[];
}): Promise<{ addedNotes: number; addedSources: number }> {
  let addedNotes = 0;
  let addedSources = 0;

  const notes = await getRaw();
  const noteIds = new Set(notes.map((n) => n.id));
  for (const raw of incoming.notes ?? []) {
    const note = sanitizeNote(raw);
    if (note && !noteIds.has(note.id)) {
      notes.push(note);
      noteIds.add(note.id);
      addedNotes++;
    }
  }
  if (addedNotes > 0) await writeNotes(notes);

  const sources = await getRawSources();
  const sourceIds = new Set(sources.map((s) => s.id));
  for (const raw of incoming.sources ?? []) {
    const source = sanitizeSource(raw);
    if (source && !sourceIds.has(source.id)) {
      sources.push(source);
      sourceIds.add(source.id);
      addedSources++;
    }
  }
  if (addedSources > 0) await writeSources(sources);

  return { addedNotes, addedSources };
}
