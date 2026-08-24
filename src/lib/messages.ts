import type { NewNoteInput } from './types';

/** Runtime messages sent between content script, background, and side panel. */
export type RuntimeMessage =
  | { type: 'ADD_NOTE'; payload: NewNoteInput }
  | { type: 'OPEN_SIDE_PANEL' }
  | { type: 'FOCUS_NOTE'; payload: { noteId: string; sourceKey: string } };

export type RuntimeResponse =
  | { ok: true }
  | { ok: false; error: string };

/** Typed wrapper around chrome.runtime.sendMessage. Never throws — a failed send
 *  (e.g. the extension was reloaded and this content script's context is now
 *  invalidated, or the service worker didn't respond) resolves to an error
 *  response instead of rejecting, so callers can always recover the UI. */
export async function sendMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  try {
    const res = (await chrome.runtime.sendMessage(message)) as RuntimeResponse | undefined;
    // A missing response usually means the service worker never replied.
    return res ?? { ok: false, error: 'No response from the extension.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/context invalidated/i.test(msg)) {
      return { ok: false, error: 'Extension was updated — reload this page and try again.' };
    }
    return { ok: false, error: msg };
  }
}
