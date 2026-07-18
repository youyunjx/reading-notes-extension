import { addNote, setPendingCapture } from '../lib/storage';
import type { RuntimeMessage, RuntimeResponse } from '../lib/messages';
import type { NoteSource } from '../lib/types';

const CONTEXT_MENU_ID = 'save-selection-as-note';

// Clicking the toolbar icon opens the side panel on the current tab.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Save selection as reading note',
    contexts: ['selection'],
  });
});

// Open the side panel when the action (toolbar) icon is clicked.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('[Reading Notes] setPanelBehavior failed', err));

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
      const windowId = sender.tab?.windowId;
      if (windowId != null) {
        chrome.sidePanel
          .open({ windowId })
          .then(() => sendResponse({ ok: true }))
          .catch((err) =>
            sendResponse({ ok: false, error: err?.message ?? String(err) }),
          );
        return true;
      }
      sendResponse({ ok: false, error: 'No window to open side panel in' });
      return false;
    }

    return false;
  },
);
