import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getNotes,
  subscribeNotes,
  deleteNote,
  updateNote,
  addNote,
  getPendingCapture,
  subscribePendingCapture,
  clearPendingCapture,
  getSources,
  subscribeSources,
  saveSource,
  importData,
  getFocus,
  subscribeFocus,
  clearFocus,
  isPdfViewerEnabled,
  setPdfViewerEnabled,
  subscribePdfViewerEnabled,
} from '../lib/storage';
import { exportNotesToCsv } from '../lib/exportCsv';
import { exportBackup, parseBackup } from '../lib/backup';
import { sendMessage } from '../lib/messages';
import type {
  Citation,
  FocusRequest,
  Note,
  PendingCapture,
  SavedSource,
} from '../lib/types';
import { SearchBar } from './components/SearchBar';
import { SourceFilter } from './components/SourceFilter';
import { NoteCard } from './components/NoteCard';
import { EmptyState } from './components/EmptyState';
import { ComposeDraft } from './components/ComposeDraft';

interface SourceGroup {
  key: string;
  title: string;
  url: string;
  faviconUrl?: string;
  notes: Note[];
}

/** Stable key identifying a note's source (used for grouping and filtering). */
function sourceKey(note: Note): string {
  return note.source.url || note.source.title || 'unknown';
}

/** Group notes by their source URL, preserving newest-first ordering. */
function groupBySource(notes: Note[]): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  for (const note of notes) {
    const key = sourceKey(note);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        title: note.source.title || note.source.url || 'Untitled source',
        url: note.source.url,
        faviconUrl: note.source.faviconUrl,
        notes: [],
      };
      groups.set(key, group);
    }
    group.notes.push(note);
  }
  return [...groups.values()];
}

function matches(note: Note, q: string): boolean {
  const c = note.citation;
  const citationText = c
    ? `${c.author} ${c.editor} ${c.bookName} ${c.chapter} ${c.page} ${c.publisher} ${c.year}`
    : '';
  const hay =
    `${note.quote}\n${note.insight}\n${note.source.title}\n${note.source.url}\n${citationText}`.toLowerCase();
  return hay.includes(q);
}

export function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState('');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [pending, setPending] = useState<PendingCapture | null>(null);
  const [sources, setSources] = useState<SavedSource[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  const [pdfViewer, setPdfViewer] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const statusTimer = useRef<number | undefined>(undefined);

  function flashStatus(message: string) {
    setStatus(message);
    if (statusTimer.current) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(null), 4000);
  }

  useEffect(() => {
    getNotes().then((n) => {
      setNotes(n);
      setLoading(false);
    });
    const unsubscribe = subscribeNotes(setNotes);
    return unsubscribe;
  }, []);

  // Watch for a right-click capture waiting to be turned into a note.
  //
  // Two delivery paths must both work, because the capture can be written either
  // just BEFORE this panel mounts (freshly opened by the context menu) or AFTER
  // (panel already open):
  //   1. subscription — catches writes that happen after we start listening.
  //   2. seed read — catches a write that already happened before mount, and
  //      re-checks whenever the panel regains focus/visibility.
  // The seed only *sets* a found capture and never clears one, so a slow "nothing
  // pending" read can't wipe a value the subscription just delivered.
  useEffect(() => {
    let active = true;

    const unsubscribe = subscribePendingCapture((capture) => {
      if (active) setPending(capture);
    });

    const seed = () =>
      getPendingCapture().then((capture) => {
        if (active && capture) setPending((prev) => prev ?? capture);
      });

    seed();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void seed();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      active = false;
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  // Load and track the reusable citation sources.
  useEffect(() => {
    getSources().then(setSources);
    const unsubscribe = subscribeSources(setSources);
    return unsubscribe;
  }, []);

  // PDF viewer preference.
  useEffect(() => {
    isPdfViewerEnabled().then(setPdfViewer);
    return subscribePdfViewerEnabled(setPdfViewer);
  }, []);

  // Respond to a focus request from an on-page marker or the corner badge:
  // filter to that source and (if a specific note was given) scroll/flash it.
  // Consumed once, then cleared. Re-seeds when the panel regains visibility so a
  // request that lands just as the panel opens isn't missed.
  useEffect(() => {
    let active = true;
    const apply = (f: FocusRequest | null) => {
      if (!active || !f) return;
      // Clear any active search so the target note is guaranteed to be visible,
      // then narrow to its source and flag it for scroll/flash.
      setQuery('');
      setSelectedSources([f.sourceKey]);
      if (f.noteId) setFocusNoteId(f.noteId);
      void clearFocus();
    };
    const unsubscribe = subscribeFocus(apply);
    const seed = () => getFocus().then((f) => apply(f));
    seed();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void seed();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      active = false;
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  async function handleSaveDraft(insight: string, citation: Citation) {
    if (!pending) return;
    await addNote({
      quote: pending.quote,
      insight,
      source: pending.source,
      citation,
    });
    await clearPendingCapture();
    setPending(null);
  }

  async function handleCancelDraft() {
    await clearPendingCapture();
    setPending(null);
  }

  async function handleSaveSource(citation: Citation) {
    await saveSource(citation);
  }

  /** Open the note's document (web page, local HTML, or PDF) and scroll to it. */
  function handleGoToSource(note: Note) {
    if (!note.source.url) {
      flashStatus('This note has no source URL to open.');
      return;
    }
    void sendMessage({
      type: 'NAVIGATE_TO_NOTE',
      payload: {
        noteId: note.id,
        url: note.source.url,
        quote: note.quote,
        ...(note.source.pdfPage ? { pdfPage: note.source.pdfPage } : {}),
      },
    });
  }

  async function handleExportBackup() {
    try {
      await exportBackup();
    } catch (err) {
      console.error('[Reading Notes] Backup export failed:', err);
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    try {
      const text = await file.text();
      const { notes: n, sources: s } = parseBackup(text);
      const { addedNotes, addedSources } = await importData({ notes: n, sources: s });
      flashStatus(
        addedNotes || addedSources
          ? `Imported ${addedNotes} note(s)` +
              (addedSources ? ` and ${addedSources} source(s)` : '') +
              '.'
          : 'Nothing new to import (already present).',
      );
    } catch (err) {
      console.error('[Reading Notes] Import failed:', err);
      flashStatus('Import failed — is this a valid backup JSON file?');
    }
  }

  // Distinct sources for the filter dropdown, with a note count each.
  const sourceOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number }>();
    for (const note of notes) {
      const key = sourceKey(note);
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, {
          key,
          label: note.source.title || note.source.url || 'Untitled source',
          count: 1,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [notes]);

  // Drop any selected sources that no longer exist (e.g. their last note was
  // deleted). Skip while notes are still loading (empty options) so a filter set
  // by a focus request isn't wiped before its source appears.
  useEffect(() => {
    if (sourceOptions.length === 0) return;
    setSelectedSources((prev) => {
      const valid = prev.filter((k) => sourceOptions.some((s) => s.key === k));
      return valid.length === prev.length ? prev : valid;
    });
  }, [sourceOptions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (selectedSources.length > 0 && !selectedSources.includes(sourceKey(n))) return false;
      if (q && !matches(n, q)) return false;
      return true;
    });
  }, [notes, query, selectedSources]);

  function toggleSource(key: string) {
    setSelectedSources((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  const groups = useMemo(() => groupBySource(filtered), [filtered]);

  // Scroll to and briefly flash the focused note once it's rendered.
  useEffect(() => {
    if (!focusNoteId) return;
    const raf = requestAnimationFrame(() => {
      document
        .getElementById(`rn-note-${focusNoteId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const clear = window.setTimeout(() => setFocusNoteId(null), 2200);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(clear);
    };
  }, [focusNoteId, filtered]);

  async function handleDelete(id: string) {
    await deleteNote(id);
  }

  async function handleSaveEdit(
    id: string,
    insight: string,
    quote: string,
    citation: Citation,
  ) {
    await updateNote(id, { insight, quote, citation });
  }

  async function handleExport() {
    if (exporting || notes.length === 0) return;
    setExporting(true);
    try {
      await exportNotesToCsv(notes);
    } catch (err) {
      console.error('[Reading Notes] CSV export failed:', err);
      alert('Sorry, exporting the CSV failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">
          <span aria-hidden>📖</span>
          <span className="app-title-text">Reading Notes</span>
          <span className="badge">{notes.length}</span>
        </h1>

        <div className="toolbar">
          <button
            className="tool-btn"
            onClick={handleExport}
            disabled={exporting || notes.length === 0}
            title="Export all notes to a CSV file, then open its folder"
          >
            {exporting ? 'Exporting…' : '⬇ CSV'}
          </button>
          <button
            className="tool-btn"
            onClick={handleExportBackup}
            disabled={notes.length === 0}
            title="Save a JSON backup (choose where — e.g. your project folder)"
          >
            ⬇ Backup
          </button>
          <button
            className="tool-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Restore notes from a JSON backup file"
          >
            ⬆ Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />
        </div>

        {status && <div className="toolbar-status">{status}</div>}

        <label className="pdf-toggle" title="Open PDFs in the Reading Notes viewer so you can highlight and annotate them">
          <input
            type="checkbox"
            checked={pdfViewer}
            onChange={(e) => void setPdfViewerEnabled(e.target.checked)}
          />
          <span>Annotate PDFs in Reading Notes viewer</span>
        </label>

        <SearchBar value={query} onChange={setQuery} />

        {sourceOptions.length > 1 && (
          <SourceFilter
            options={sourceOptions}
            selected={selectedSources}
            onToggle={toggleSource}
            onClear={() => setSelectedSources([])}
          />
        )}
      </header>

      {pending && (
        <ComposeDraft
          key={pending.at}
          capture={pending}
          sources={sources}
          onSave={handleSaveDraft}
          onSaveSource={handleSaveSource}
          onCancel={handleCancelDraft}
        />
      )}

      {loading ? null : notes.length === 0 ? (
        pending ? null : <EmptyState variant="no-notes" />
      ) : filtered.length === 0 ? (
        <EmptyState variant="no-results" query={query} />
      ) : (
        <div className="notes">
          {groups.map((group) => (
            <div className="source-group" key={group.key}>
              <div className="source-header">
                <Favicon url={group.url} title={group.title} />
                {group.url ? (
                  <a href={group.url} target="_blank" rel="noreferrer" title={group.url}>
                    {group.title}
                  </a>
                ) : (
                  <span>{group.title}</span>
                )}
              </div>
              {group.notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  sources={sources}
                  domId={`rn-note-${note.id}`}
                  flash={focusNoteId === note.id}
                  onDelete={handleDelete}
                  onSaveEdit={handleSaveEdit}
                  onSaveSource={handleSaveSource}
                  onGoToSource={handleGoToSource}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Renders a local letter-avatar for the source. We deliberately do NOT load the
// site's real favicon over the network — that would ping the source server every
// time you open the panel (breaking offline use and leaking that you're reviewing
// the note). Everything here stays on-device.
function Favicon({ url, title }: { url: string; title: string }) {
  const letter = (title || url || '?').trim().charAt(0).toUpperCase() || '?';
  return <span className="favicon-fallback" aria-hidden>{letter}</span>;
}
