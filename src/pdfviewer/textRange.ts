// Locates a quoted passage inside a rendered PDF.js text layer and reports the
// rectangles it occupies, so highlights can be drawn as an overlay (rather than
// mutating PDF.js's own DOM).

interface CharPos {
  node: Text;
  offset: number;
}

/**
 * Strip *all* whitespace for matching.
 *
 * PDF.js renders each text run as its own <span> and marks line ends with
 * <br>, so the spaces you see are often produced by layout rather than by real
 * space characters. A copied selection therefore contains spaces the DOM text
 * doesn't have (and vice versa). Ignoring whitespace entirely makes the match
 * robust in both directions.
 */
function stripWs(s: string): string {
  return s.replace(/\s+/g, '');
}

/** Whitespace-free text of a container, mapped back to (node, offset). */
function buildIndex(container: HTMLElement): { text: string; map: CharPos[] } {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let text = '';
  const map: CharPos[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const t = node as Text;
    const v = t.nodeValue ?? '';
    for (let i = 0; i < v.length; i++) {
      if (/\s/.test(v[i])) continue; // whitespace ignored on both sides
      text += v[i];
      map.push({ node: t, offset: i });
    }
  }
  return { text, map };
}

/**
 * Find `quote` inside `container` and return a DOM Range covering it, or null.
 * Matching is whitespace-insensitive and case-insensitive, which tolerates the
 * spacing quirks of PDF text extraction.
 */
export function findQuoteRange(container: HTMLElement, quote: string): Range | null {
  const needle = stripWs(quote).toLowerCase();
  if (needle.length < 2) return null;

  const { text, map } = buildIndex(container);
  const idx = text.toLowerCase().indexOf(needle);
  if (idx === -1) return null;

  const start = map[idx];
  const end = map[idx + needle.length - 1];
  if (!start || !end) return null;

  try {
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, Math.min(end.offset + 1, end.node.length));
    return range;
  } catch {
    return null;
  }
}

export interface RectBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Client rects of a range, converted to coordinates relative to `origin`. */
export function rectsRelativeTo(range: Range, origin: HTMLElement): RectBox[] {
  const base = origin.getBoundingClientRect();
  return [...range.getClientRects()]
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({
      left: r.left - base.left,
      top: r.top - base.top,
      width: r.width,
      height: r.height,
    }));
}

/** The 1-based PDF page number a DOM node sits on, if any. */
export function pageNumberOf(node: Node | null): number | null {
  const el =
    node instanceof Element ? node : (node?.parentElement ?? null);
  const pageEl = el?.closest<HTMLElement>('[data-page-number]');
  const n = pageEl ? Number(pageEl.dataset.pageNumber) : NaN;
  return Number.isFinite(n) ? n : null;
}
