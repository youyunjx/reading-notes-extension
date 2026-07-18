import { useCallback, useEffect, useRef, useState } from 'react';
import { SelectionButton } from './SelectionButton';
import { Composer } from './Composer';
import { sendMessage } from '../lib/messages';
import type { Citation, NoteSource } from '../lib/types';

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

export function ContentApp() {
  const [quote, setQuote] = useState('');
  const [buttonAnchor, setButtonAnchor] = useState<Anchor | null>(null);
  const [composerAnchor, setComposerAnchor] = useState<Anchor | null>(null);
  const [saved, setSaved] = useState(false);
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

  const openComposer = useCallback(() => {
    if (buttonAnchor) setComposerAnchor(buttonAnchor);
    setButtonAnchor(null);
  }, [buttonAnchor]);

  const handleSave = useCallback(
    async (insight: string, citation?: Citation) => {
      const res = await sendMessage({
        type: 'ADD_NOTE',
        payload: { quote, insight, source: getPageSource(), citation },
      });
      if (!res.ok) {
        console.error('[Reading Notes] Failed to save note:', res.error);
        return;
      }
      closeAll();
      setSaved(true);
      savedTimer.current = window.setTimeout(() => setSaved(false), 1800);
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
      {saved && <SavedToast />}
    </>
  );
}

function SavedToast() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
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
