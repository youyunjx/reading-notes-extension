import { addNote, setPendingCapture, setFocus } from '../lib/storage';
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

    if (message.type === 'FOCUS_NOTE') {
      // Open the panel FIRST, synchronously, so the user gesture is preserved.
      openPanel(sender)?.catch((err) =>
        console.warn('[Reading Notes] sidePanel.open failed:', err),
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
