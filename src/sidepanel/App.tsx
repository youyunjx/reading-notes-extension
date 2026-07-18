import { useEffect, useMemo, useState } from 'react';
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
} from '../lib/storage';
import { exportNotesToCsv } from '../lib/exportCsv';
import type { Citation, Note, PendingCapture, SavedSource } from '../lib/types';
import { SearchBar } from './components/SearchBar';
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

/** Group notes by their source URL, preserving newest-first ordering. */
function groupBySource(notes: Note[]): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  for (const note of notes) {
    const key = note.source.url || note.source.title || 'unknown';
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
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [pending, setPending] = useState<PendingCapture | null>(null);
  const [sources, setSources] = useState<SavedSource[]>([]);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => matches(n, q));
  }, [notes, query]);

  const groups = useMemo(() => groupBySource(filtered), [filtered]);

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
          <button
            className="export-btn"
            onClick={handleExport}
            disabled={exporting || notes.length === 0}
            title="Export all notes to a CSV file, then open its folder"
          >
            {exporting ? 'Exporting…' : '⬇ Export CSV'}
          </button>
        </h1>
        <SearchBar value={query} onChange={setQuery} />
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
                  onDelete={handleDelete}
                  onSaveEdit={handleSaveEdit}
                  onSaveSource={handleSaveSource}
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
