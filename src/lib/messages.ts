import type { NewNoteInput } from './types';

/** Runtime messages sent between content script, background, and side panel. */
export type RuntimeMessage =
  | { type: 'ADD_NOTE'; payload: NewNoteInput }
  | { type: 'OPEN_SIDE_PANEL' };

export type RuntimeResponse =
  | { ok: true }
  | { ok: false; error: string };

/** Typed wrapper around chrome.runtime.sendMessage. */
export function sendMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  return chrome.runtime.sendMessage(message);
}
