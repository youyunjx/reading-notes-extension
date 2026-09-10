import { addNote, setPendingCapture, setFocus, isPdfViewerEnabled } from '../lib/storage';
import type { RuntimeMessage, RuntimeResponse } from '../lib/messages';
import type { NoteSource } from '../lib/types';

const CONTEXT_MENU_ID = 'save-selection-as-note';

// --- PDF interception -------------------------------------------------------
// Chrome's built-in PDF viewer is closed to extensions, so PDFs can't be
// highlighted there. Redirect PDF navigations to our own PDF.js-based viewer,
// which renders a real text layer we can select and highlight.

const PDF_URL_RE = /\.pdf(?:[?#]|$)/i;

function viewerUrlFor(fileUrl: string): string {
  return `${chrome.runtime.getURL('src/pdfviewer/index.html')}?file=${encodeURIComponent(fileUrl)}`;
}

// --- Navigate to a note's position in its document ---------------------------

const stripHash = (u: string) => u.split('#')[0];

/** Ask a tab's content script to scroll to a quote (no-op if it can't). */
function requestScroll(tabId: number, noteId: string, quote: string): void {
  chrome.tabs
    .sendMessage(tabId, { type: 'SCROLL_TO_QUOTE', payload: { noteId, quote } })
    .catch(() => {
      /* no content script here (restricted page) — the tab still opened */
    });
}

/** Scroll once the tab has finished loading (for tabs we just created). */
function scrollWhenReady(tabId: number, noteId: string, quote: string): void {
  const listener = (updatedId: number, info: chrome.tabs.TabChangeInfo) => {
    if (updatedId !== tabId || info.status !== 'complete') return;
    chrome.tabs.onUpdated.removeListener(listener);
    // Give the content script a moment to mount before asking it to scroll.
    setTimeout(() => requestScroll(tabId, noteId, quote), 350);
  };
  chrome.tabs.onUpdated.addListener(listener);
  // Don't leak the listener if the page never reports "complete".
  setTimeout(() => chrome.tabs.onUpdated.removeListener(listener), 30_000);
}

async function navigateToNote(payload: {
  noteId: string;
  url: string;
  quote: string;
  pdfPage?: number;
}): Promise<void> {
  const isPdf = typeof payload.pdfPage === 'number';
  const targetUrl = isPdf
    ? `${viewerUrlFor(payload.url)}&note=${encodeURIComponent(payload.noteId)}`
    : payload.url;

  const viewerPrefix = chrome.runtime.getURL('src/pdfviewer/index.html');
  const encodedFile = encodeURIComponent(payload.url);

  // Reuse a tab already showing this document, if there is one.
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((t) => {
    if (!t.url) return false;
    if (isPdf) {
      return t.url.startsWith(viewerPrefix) && t.url.includes(encodedFile);
    }
    return stripHash(t.url) === stripHash(payload.url);
  });

  if (existing?.id != null) {
    // For PDFs, re-navigate so the viewer picks up the ?note= target.
    await chrome.tabs.update(existing.id, {
      active: true,
      ...(isPdf ? { url: targetUrl } : {}),
    });
    if (existing.windowId != null) {
      await chrome.windows.update(existing.windowId, { focused: true }).catch(() => undefined);
    }
    if (isPdf) {
      scrollWhenReady(existing.id, payload.noteId, payload.quote);
    } else {
      requestScroll(existing.id, payload.noteId, payload.quote);
    }
    return;
  }

  const created = await chrome.tabs.create({ url: targetUrl });
  if (!isPdf && created.id != null) {
    scrollWhenReady(created.id, payload.noteId, payload.quote);
  }
}

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // top-level navigations only
  const url = details.url;
  // Never intercept our own pages (avoids a redirect loop).
  if (url.startsWith(chrome.runtime.getURL(''))) return;
  if (!PDF_URL_RE.test(url)) return;
  if (!(await isPdfViewerEnabled())) return;
  try {
    await chrome.tabs.update(details.tabId, { url: viewerUrlFor(url) });
  } catch (err) {
    console.warn('[Jot] PDF redirect failed:', err);
  }
});

// Clicking the toolbar icon opens the side panel on the current tab.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Save selection as a note',
    contexts: ['selection'],
  });
});

// Open the side panel when the action (toolbar) icon is clicked.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('[Jot] setPanelBehavior failed', err));

// Context-menu path: stash the selection as a "pending capture" and open the
// side panel, where the user types their insight and saves. We open the panel
// first (it must happen synchronously within the user gesture) before the async
// storage write.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.selectionText) return;

  if (tab?.windowId != null) {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {
      /* side panel may already be open or unavailable */
    });
  }

  const source: NoteSource = {
    url: info.pageUrl ?? tab?.url ?? '',
    title: tab?.title ?? '',
    faviconUrl: tab?.favIconUrl,
  };
  void setPendingCapture({
    quote: info.selectionText,
    source,
    at: Date.now(),
  });
});

// Message router for content script + side panel.
chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, sender, sendResponse: (r: RuntimeResponse) => void) => {
    if (message.type === 'ADD_NOTE') {
      addNote(message.payload)
        .then(() => sendResponse({ ok: true }))
        .catch((err) =>
          sendResponse({ ok: false, error: err?.message ?? String(err) }),
        );
      return true; // async response
    }

    if (message.type === 'OPEN_SIDE_PANEL') {
      // Call open() synchronously to preserve the click's user gesture.
      const opening = openPanel(sender);
      if (!opening) {
        sendResponse({ ok: false, error: 'No tab/window to open side panel in' });
        return false;
      }
      opening
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err?.message ?? String(err) }));
      return true;
    }

    if (message.type === 'NAVIGATE_TO_NOTE') {
      navigateToNote(message.payload)
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err?.message ?? String(err) }));
      return true;
    }

    if (message.type === 'FOCUS_NOTE') {
      // Open the panel FIRST, synchronously, so the user gesture is preserved.
      openPanel(sender)?.catch((err) =>
        console.warn('[Jot] sidePanel.open failed:', err),
      );
      // Record the focus request independently; the side panel reads it on open.
      void setFocus({ ...message.payload, at: Date.now() });
      sendResponse({ ok: true });
      return false;
    }

    return false;
  },
);

/** Open the side panel for the message sender's tab/window. Returns the open()
 *  promise, or null if there's nowhere to open it. Must be called synchronously
 *  within the message handler to keep the user gesture valid. */
function openPanel(sender: chrome.runtime.MessageSender): Promise<void> | null {
  if (sender.tab?.id != null) return chrome.sidePanel.open({ tabId: sender.tab.id });
  if (sender.tab?.windowId != null) {
    return chrome.sidePanel.open({ windowId: sender.tab.windowId });
  }
  return null;
}
