import type { PdfAnnotation } from './types';

// PDF drawings (text boxes, rectangles, ellipses, arrows) live under their own
// storage key so they stay separate from reading notes. Local only — same
// privacy guarantees as the rest of Jot.
const ANNOTATIONS_KEY = 'pdfAnnotations';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function readAll(): Promise<PdfAnnotation[]> {
  const result = await chrome.storage.local.get(ANNOTATIONS_KEY);
  return (result[ANNOTATIONS_KEY] as PdfAnnotation[] | undefined) ?? [];
}

async function writeAll(list: PdfAnnotation[]): Promise<void> {
  await chrome.storage.local.set({ [ANNOTATIONS_KEY]: list });
}

/** All annotations belonging to one PDF. */
export async function getAnnotations(fileUrl: string): Promise<PdfAnnotation[]> {
  return (await readAll()).filter((a) => a.fileUrl === fileUrl);
}

export async function addAnnotation(
  input: Omit<PdfAnnotation, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<PdfAnnotation> {
  const now = Date.now();
  const annotation: PdfAnnotation = { ...input, id: newId(), createdAt: now, updatedAt: now };
  const all = await readAll();
  all.push(annotation);
  await writeAll(all);
  return annotation;
}

export async function updateAnnotation(
  id: string,
  patch: Partial<Pick<PdfAnnotation, 'x' | 'y' | 'w' | 'h' | 'text' | 'color' | 'fontSize'>>,
): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], ...patch, updatedAt: Date.now() };
  await writeAll(all);
}

export async function deleteAnnotation(id: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((a) => a.id !== id));
}

/** Subscribe to annotation changes for one PDF. */
export function subscribeAnnotations(
  fileUrl: string,
  callback: (annotations: PdfAnnotation[]) => void,
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string,
  ) => {
    if (areaName !== 'local' || !(ANNOTATIONS_KEY in changes)) return;
    const list = (changes[ANNOTATIONS_KEY].newValue as PdfAnnotation[] | undefined) ?? [];
    callback(list.filter((a) => a.fileUrl === fileUrl));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
