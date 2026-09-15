import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { addNote, getNotes, subscribeNotes } from '../lib/storage';
import { sendMessage } from '../lib/messages';
import type { Note } from '../lib/types';
import { PdfPage } from './PdfPage';
import { pageNumberOf } from './textRange';

// Bundled locally by Vite — no CDN, so the viewer works offline.
GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).href;

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

interface Draft {
  quote: string;
  page: number;
  x: number;
  y: number;
}

function fileNameOf(url: string): string {
  try {
    const path = new URL(url).pathname;
    return decodeURIComponent(path.split('/').pop() || url);
  } catch {
    return url;
  }
}

/** Make a filename safe for chrome.downloads (no path separators or reserved
 *  characters) and ensure it ends in .pdf. Falls back to "document.pdf" when the
 *  URL has no usable filename. */
function safePdfName(name: string): string {
  // A name still containing "://" means fileNameOf fell back to the whole URL.
  let base = name.includes('://') ? '' : name;
  base = base.replace(/[\\/:*?"<>|]+/g, '_').trim();
  if (!base || /^_+$/.test(base)) base = 'document.pdf';
  return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
}

export function PdfViewer() {
  const fileUrl = useMemo(
    () => new URLSearchParams(location.search).get('file') ?? '',
    [],
  );
  const fileName = useMemo(() => fileNameOf(fileUrl), [fileUrl]);
  // ?note=<id> — jump to that note's page and flash its highlight.
  const [targetNoteId, setTargetNoteId] = useState<string | null>(
    () => new URLSearchParams(location.search).get('note'),
  );

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.3);
  const [notes, setNotes] = useState<Note[]>([]);
  const [pending, setPending] = useState<Draft | null>(null); // "Add note" button
  const [draft, setDraft] = useState<Draft | null>(null); // open composer
  const [insight, setInsight] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  /** Bytes supplied by the user via the file picker, when the URL can't be read. */
  const [localData, setLocalData] = useState<Uint8Array | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const filePickerRef = useRef<HTMLInputElement>(null);

  const isLocalFile = fileUrl.startsWith('file:');

  // Load the document — either from its URL, or from bytes the user picked.
  useEffect(() => {
    if (!fileUrl) {
      setError('No PDF specified.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const task = localData
          ? getDocument({ data: localData })
          : getDocument({ url: fileUrl });
        const loaded = await task.promise;
        if (cancelled) return;
        setDoc(loaded);
        document.title = `${fileName} — Jot`;
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUrl, fileName, localData]);

  /** Load a PDF the user picked from disk. Works with no permissions at all —
   *  the browser hands us the bytes directly, so it's the reliable way to open
   *  a local file when "Allow access to file URLs" is off. Notes still key off
   *  the original file:// URL, so anything saved earlier still lines up. */
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      setDoc(null);
      setLocalData(new Uint8Array(buf));
    } catch (err) {
      console.error('[Jot] Could not read the chosen file:', err);
      setError('Could not read that file.');
    }
  }

  // Track this file's notes (local storage; no network).
  useEffect(() => {
    const forThisFile = (all: Note[]) => all.filter((n) => n.source.url === fileUrl);
    getNotes().then((all) => setNotes(forThisFile(all)));
    return subscribeNotes((all) => setNotes(forThisFile(all)));
  }, [fileUrl]);

  useEffect(() => {
    if (draft) textareaRef.current?.focus();
  }, [draft]);

  // Jump to the note requested via ?note=<id> once the document and notes load.
  useEffect(() => {
    if (!targetNoteId || !doc) return;
    const note = notes.find((n) => n.id === targetNoteId);
    const page = note?.source.pdfPage;
    if (!page) return;

    let attempts = 0;
    const tryScroll = () => {
      const el = document.querySelector<HTMLElement>(`[data-page-number="${page}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (attempts++ < 20) window.setTimeout(tryScroll, 150);
    };
    tryScroll();

    // Keep the flash on long enough to be seen after the page renders.
    const clear = window.setTimeout(() => setTargetNoteId(null), 6000);
    return () => window.clearTimeout(clear);
  }, [targetNoteId, doc, notes]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  function flashToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }

  // Offer an "Add note" button when text is selected in the text layer.
  useEffect(() => {
    function onMouseUp(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest('.pdf-composer, .pdf-add-btn, .pdf-toolbar')) return;

      window.setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim() ?? '';
        if (!selection || selection.rangeCount === 0 || text.length < 2) {
          setPending(null);
          return;
        }
        const range = selection.getRangeAt(0);
        const page = pageNumberOf(range.startContainer);
        if (page == null) {
          setPending(null);
          return;
        }
        const rect = range.getBoundingClientRect();
        setPending({ quote: text, page, x: rect.left, y: rect.bottom });
        setDraft(null);
      }, 0);
    }
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, []);

  const openComposer = useCallback(() => {
    if (!pending) return;
    setDraft(pending);
    setInsight('');
    setPending(null);
  }, [pending]);

  async function saveDraft() {
    if (!draft) return;
    await addNote({
      quote: draft.quote,
      insight,
      source: { url: fileUrl, title: fileName, pdfPage: draft.page },
    });
    setDraft(null);
    setInsight('');
    window.getSelection()?.removeAllRanges();
    flashToast('✓ Note saved');
  }

  /**
   * Save the PDF to disk. Uses the bytes PDF.js already holds rather than
   * re-fetching the URL: no second download, it works for local file:// PDFs,
   * and it can't be intercepted by our own PDF redirect.
   */
  async function downloadPdf() {
    if (!doc || downloading) return;
    setDownloading(true);
    let objectUrl: string | null = null;
    try {
      const data = await doc.getData();
      const blob = new Blob([data as BlobPart], { type: 'application/pdf' });
      objectUrl = URL.createObjectURL(blob);
      // `saveAs` is intentionally omitted so Chrome follows the user's own
      // "Ask where to save each file" preference, like the built-in viewer.
      await chrome.downloads.download({
        url: objectUrl,
        filename: safePdfName(fileName),
      });
      flashToast('✓ PDF downloaded');
    } catch (err) {
      console.error('[Jot] PDF download failed:', err);
      flashToast('Download failed — see console for details.');
    } finally {
      setDownloading(false);
      if (objectUrl) {
        const url = objectUrl;
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    }
  }

  const onHighlightClick = useCallback((note: Note) => {
    void sendMessage({
      type: 'FOCUS_NOTE',
      payload: { noteId: note.id, sourceKey: note.source.url || note.source.title },
    });
  }, []);

  const notesByPage = useMemo(() => {
    const map = new Map<number, Note[]>();
    for (const n of notes) {
      const p = n.source.pdfPage;
      if (!p) continue;
      const list = map.get(p);
      if (list) list.push(n);
      else map.set(p, [n]);
    }
    return map;
  }, [notes]);

  if (error) {
    return (
      <>
        <Toolbar
          fileName={fileName}
          fileUrl={fileUrl}
          scale={scale}
          setScale={setScale}
          noteCount={notes.length}
        />
        <div className="pdf-status">
          <p>
            <strong>Couldn’t open this PDF.</strong>
          </p>

          {isLocalFile ? (
            <>
              <p>
                Chrome blocks extensions from reading files on your computer unless you
                allow it. Either way works:
              </p>
              <p>
                <button className="pdf-cta" onClick={() => filePickerRef.current?.click()}>
                  📂 Open this PDF from your computer
                </button>
              </p>
              <p className="pdf-status-sub">
                Nothing to enable — pick the file and Jot opens it right away. Your
                existing notes for this file still apply.
              </p>
              <p className="pdf-status-sub">
                To skip this step in future, turn on <em>“Allow access to file URLs”</em>{' '}
                on the Jot card in <code>chrome://extensions</code>, then reload this page.
              </p>
            </>
          ) : (
            <p>{error}</p>
          )}

          <input
            ref={filePickerRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={onPickFile}
            style={{ display: 'none' }}
          />

          <p className="pdf-status-sub">
            <a href={fileUrl}>Open in Chrome’s built-in PDF viewer instead</a> (no
            highlighting)
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Toolbar
        fileName={fileName}
        fileUrl={fileUrl}
        scale={scale}
        setScale={setScale}
        noteCount={notes.length}
        onDownload={() => void downloadPdf()}
        downloading={downloading}
        canDownload={!!doc}
      />

      {!doc ? (
        <div className="pdf-status">Loading PDF…</div>
      ) : (
        <div className="pdf-pages">
          {Array.from({ length: doc.numPages }, (_, i) => i + 1).map((n) => (
            <PdfPage
              key={n}
              doc={doc}
              pageNumber={n}
              scale={scale}
              notes={notesByPage.get(n) ?? []}
              flashNoteId={targetNoteId}
              onHighlightClick={onHighlightClick}
            />
          ))}
        </div>
      )}

      {pending && (
        <button
          className="pdf-add-btn"
          style={{
            left: Math.min(pending.x, window.innerWidth - 140),
            top: Math.min(pending.y + 8, window.innerHeight - 48),
          }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={openComposer}
        >
          ✎ Add note
        </button>
      )}

      {draft && (
        <div
          className="pdf-composer"
          style={{
            left: Math.min(draft.x, window.innerWidth - 356),
            top: Math.min(draft.y + 8, window.innerHeight - 300),
          }}
        >
          <div className="pdf-composer-body">
            <div className="pdf-composer-label">Selected text · page {draft.page}</div>
            <blockquote>{draft.quote}</blockquote>
            <textarea
              ref={textareaRef}
              rows={4}
              value={insight}
              onChange={(e) => setInsight(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void saveDraft();
                if (e.key === 'Escape') setDraft(null);
              }}
              placeholder="Your insight… (⌘/Ctrl + Enter to save)"
            />
          </div>
          <div className="pdf-composer-actions">
            <button className="btn" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className="btn primary" onClick={() => void saveDraft()}>
              Save note
            </button>
          </div>
        </div>
      )}

      {/* The corner badge normally comes from the content script, which can't
          run on extension pages — so the viewer provides its own. */}
      {notes.length > 0 && (
        <button
          className="pdf-note-flag"
          title={`${notes.length} note${notes.length === 1 ? '' : 's'} in this PDF — open Jot`}
          onClick={() =>
            void sendMessage({
              type: 'FOCUS_NOTE',
              payload: { noteId: '', sourceKey: fileUrl },
            })
          }
        >
          <span aria-hidden>📖</span>
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </button>
      )}

      {toast && <div className="pdf-toast">{toast}</div>}
    </>
  );
}

function Toolbar({
  fileName,
  fileUrl,
  scale,
  setScale,
  noteCount,
  onDownload,
  downloading,
  canDownload,
}: {
  fileName: string;
  fileUrl: string;
  scale: number;
  setScale: (s: number) => void;
  noteCount: number;
  onDownload?: () => void;
  downloading?: boolean;
  canDownload?: boolean;
}) {
  return (
    <div className="pdf-toolbar">
      <span aria-hidden>📖</span>
      <span className="pdf-title" title={fileUrl}>
        {fileName}
      </span>
      <span className="pdf-hint">
        {noteCount} note{noteCount === 1 ? '' : 's'}
      </span>
      <span className="spacer" />
      <span className="pdf-hint">Select text to add a note</span>
      <button
        className="pdf-btn"
        onClick={() => setScale(Math.max(MIN_SCALE, Math.round((scale - 0.2) * 10) / 10))}
        title="Zoom out"
      >
        −
      </button>
      <span className="pdf-hint">{Math.round(scale * 100)}%</span>
      <button
        className="pdf-btn"
        onClick={() => setScale(Math.min(MAX_SCALE, Math.round((scale + 0.2) * 10) / 10))}
        title="Zoom in"
      >
        +
      </button>
      <button
        className="pdf-btn"
        onClick={onDownload}
        disabled={!canDownload || downloading}
        title="Save this PDF to your computer"
      >
        {downloading ? 'Saving…' : '⬇ Download'}
      </button>
      <button
        className="pdf-btn"
        onClick={() => void sendMessage({ type: 'OPEN_SIDE_PANEL' })}
        title="Open the Jot side panel"
      >
        Notes
      </button>
    </div>
  );
}
