import { useCallback, useEffect, useRef, useState } from 'react';
import { SelectionButton } from './SelectionButton';
import { Composer } from './Composer';
import { sendMessage } from '../lib/messages';
import type { RuntimeResponse } from '../lib/messages';
import { getNotes, subscribeNotes } from '../lib/storage';
import { applyMarkers, clearMarkers, scrollToQuote } from './highlighter';
import type { MarkTarget } from './highlighter';
import type { RuntimeMessage } from '../lib/messages';
import type { Citation, Note, NoteSource } from '../lib/types';

const HOST_ID = 'reading-notes-root';
const MIN_SELECTION_LENGTH = 1;
/** How long a cached selection stays usable after it was last seen (ms). */
const SELECTION_CACHE_TTL = 800;

interface Anchor {
  /** Viewport coordinates of the selection's bounding rect. */
  x: number;
  y: number;
}

interface CapturedSelection {
  text: string;
  anchor: Anchor;
  at: number;
}

function getPageSource(): NoteSource {
  const iconLink =
    document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.href;
  return {
    url: location.href,
    title: document.title || location.href,
    faviconUrl: iconLink || undefined,
  };
}

/** Compare page URLs ignoring the hash fragment (in-page anchors). */
function normalizeUrl(u: string): string {
  try {
    const x = new URL(u);
    x.hash = '';
    return x.href;
  } catch {
    return u;
  }
}

function isInsideOurUi(target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false;
  const host = document.getElementById(HOST_ID);
  // Clicks inside the shadow DOM retarget to the host element.
  return !!host && (target === host || host.contains(target));
}

/** Read the current selection as text + viewport anchor, or null if empty. */
function readSelection(): CapturedSelection | null {
  const selection = window.getSelection();
  const text = selection?.toString().trim() ?? '';
  if (
    !selection ||
    selection.rangeCount === 0 ||
    text.length < MIN_SELECTION_LENGTH
  ) {
    return null;
  }
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return { text, anchor: { x: rect.left, y: rect.bottom }, at: Date.now() };
}

const IS_TOP_FRAME = window.top === window;

export function ContentApp() {
  const [quote, setQuote] = useState('');
  const [buttonAnchor, setButtonAnchor] = useState<Anchor | null>(null);
  const [composerAnchor, setComposerAnchor] = useState<Anchor | null>(null);
  const [saved, setSaved] = useState(false);
  const [pageNotes, setPageNotes] = useState<Note[]>([]);
  const savedTimer = useRef<number | undefined>(undefined);
  // Latest non-empty selection, cached from `selectionchange`. This keeps
  // capture working on pages that clear the selection inside their own mouseup
  // handler — as long as they haven't outright disabled text selection/copy
  // (in which case there is nothing to cache and we stay inactive).
  const lastSelection = useRef<CapturedSelection | null>(null);

  const closeAll = useCallback(() => {
    setButtonAnchor(null);
    setComposerAnchor(null);
  }, []);

  // Offer the Add-note button for the current selection, falling back to the
  // most recent cached one if the page just cleared it.
  const offerForSelection = useCallback(() => {
    let current = readSelection();
    if (!current) {
      const cached = lastSelection.current;
      if (cached && Date.now() - cached.at <= SELECTION_CACHE_TTL) {
        current = cached;
      }
    }
    if (!current) {
      setButtonAnchor(null);
      return;
    }
    setQuote(current.text);
    setButtonAnchor(current.anchor);
    setComposerAnchor(null);
  }, []);

  useEffect(() => {
    function onSelectionChange() {
      const sel = readSelection();
      // Only cache non-empty selections so a page clearing the selection can't
      // wipe what we just captured.
      if (sel) lastSelection.current = sel;
    }

    function onMouseUp(e: MouseEvent) {
      if (isInsideOurUi(e.target)) return;
      // Defer so the browser (and the page) have finalized the selection.
      window.setTimeout(offerForSelection, 0);
    }

    function onKeyUp(e: KeyboardEvent) {
      if (isInsideOurUi(e.target)) return;
      // Keyboard selection: Shift+arrows/Home/End, or Ctrl/Cmd+A.
      const isSelectAll = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a';
      if (e.shiftKey || e.key === 'Shift' || isSelectAll) {
        window.setTimeout(offerForSelection, 0);
      }
    }

    function onMouseDown(e: MouseEvent) {
      if (isInsideOurUi(e.target)) return;
      // Starting a new interaction outside our UI hides the button.
      setButtonAnchor(null);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeAll();
    }

    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [offerForSelection, closeAll]);

  useEffect(() => {
    return () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    };
  }, []);

  // Track which saved notes belong to the current page/frame. Drives both the
  // "notes on this page" flag (top frame) and the inline markers (all frames).
  // Fully local — reads chrome.storage.local, no network. Recomputes when notes
  // change and when the URL changes (SPA navigations caught by a light poll).
  useEffect(() => {
    let notesCache: Note[] = [];
    let currentUrl = normalizeUrl(location.href);
    const recompute = () =>
      setPageNotes(notesCache.filter((n) => normalizeUrl(n.source.url) === currentUrl));

    getNotes().then((n) => {
      notesCache = n;
      recompute();
    });
    const unsubscribe = subscribeNotes((n) => {
      notesCache = n;
      recompute();
    });

    const onNav = () => {
      const u = normalizeUrl(location.href);
      if (u !== currentUrl) {
        currentUrl = u;
        recompute();
      }
    };
    window.addEventListener('popstate', onNav);
    window.addEventListener('hashchange', onNav);
    const poll = window.setInterval(onNav, 1500);

    return () => {
      unsubscribe();
      window.removeEventListener('popstate', onNav);
      window.removeEventListener('hashchange', onNav);
      window.clearInterval(poll);
    };
  }, []);

  // The side panel can ask us to jump to a saved quote on this page. Runs in
  // every frame; whichever frame contains the text does the scrolling.
  useEffect(() => {
    const listener = (message: RuntimeMessage) => {
      if (message.type === 'SCROLL_TO_QUOTE') {
        scrollToQuote(message.payload.quote);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  // Clicking an inline marker asks the side panel to focus that note.
  const onMarkerClick = useCallback((t: MarkTarget) => {
    void sendMessage({
      type: 'FOCUS_NOTE',
      payload: { noteId: t.id, sourceKey: t.sourceKey },
    });
  }, []);

  // (Re)insert inline markers whenever this page's notes change. A short delayed
  // re-run catches content that renders slightly after we first look.
  useEffect(() => {
    const targets: MarkTarget[] = pageNotes.map((n) => ({
      id: n.id,
      quote: n.quote,
      sourceKey: n.source.url || n.source.title || 'unknown',
    }));
    applyMarkers(targets, onMarkerClick);
    const retry = window.setTimeout(() => applyMarkers(targets, onMarkerClick), 1200);
    return () => {
      window.clearTimeout(retry);
      clearMarkers();
    };
  }, [pageNotes, onMarkerClick]);

  // Corner badge: open the side panel filtered to this page's source (no
  // specific note). Falls back to a plain open if we somehow have no notes.
  const openSidePanel = useCallback(() => {
    const first = pageNotes[0];
    if (first) {
      const sourceKey = first.source.url || first.source.title || 'unknown';
      void sendMessage({ type: 'FOCUS_NOTE', payload: { noteId: '', sourceKey } });
    } else {
      void sendMessage({ type: 'OPEN_SIDE_PANEL' });
    }
  }, [pageNotes]);

  const openComposer = useCallback(() => {
    if (buttonAnchor) setComposerAnchor(buttonAnchor);
    setButtonAnchor(null);
  }, [buttonAnchor]);

  const handleSave = useCallback(
    async (insight: string, citation?: Citation): Promise<RuntimeResponse> => {
      const res = await sendMessage({
        type: 'ADD_NOTE',
        payload: { quote, insight, source: getPageSource(), citation },
      });
      if (!res.ok) {
        console.error('[Reading Notes] Failed to save note:', res.error);
        return res;
      }
      closeAll();
      setSaved(true);
      savedTimer.current = window.setTimeout(() => setSaved(false), 1800);
      return res;
    },
    [quote, closeAll],
  );

  return (
    <>
      {buttonAnchor && (
        <SelectionButton anchor={buttonAnchor} onClick={openComposer} />
      )}
      {composerAnchor && (
        <Composer
          anchor={composerAnchor}
          quote={quote}
          onSave={handleSave}
          onCancel={closeAll}
        />
      )}
      {IS_TOP_FRAME && pageNotes.length > 0 && (
        <PageNoteFlag count={pageNotes.length} onClick={openSidePanel} />
      )}
      {saved && <SavedToast />}
    </>
  );
}

/** Small badge shown when the current page already has saved notes. */
function PageNoteFlag({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={`${count} note${count === 1 ? '' : 's'} on this page — open Reading Notes`}
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        background: '#4F46E5',
        color: '#fff',
        border: 'none',
        borderRadius: 999,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(79,70,229,0.4)',
        zIndex: 2147483646,
      }}
    >
      <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
        📖
      </span>
      {count} {count === 1 ? 'note' : 'notes'}
    </button>
  );
}

function SavedToast() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 74,
        right: 24,
        background: '#111827',
        color: '#fff',
        padding: '10px 16px',
        borderRadius: 8,
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        zIndex: 2147483647,
      }}
    >
      ✓ Note saved
    </div>
  );
}
