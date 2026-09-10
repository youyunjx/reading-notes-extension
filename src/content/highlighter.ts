// Finds a note's quoted text in the page DOM and inserts a small clickable
// marker icon right after it. Best-effort and fully local (no network):
//  - matches are whitespace-normalized so minor spacing differences still hit;
//  - a quote that spans complex markup or lives on a <canvas> won't be found;
//  - markers are re-applied whenever notes or the URL change.

const MARKER_ATTR = 'data-rn-note-marker';
const HOST_ID = 'jot-root';

export interface MarkTarget {
  id: string;
  quote: string;
  sourceKey: string;
}

/** Remove all previously inserted markers. */
export function clearMarkers(): void {
  document.querySelectorAll(`[${MARKER_ATTR}]`).forEach((el) => el.remove());
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

interface CharPos {
  node: Text;
  offset: number;
}

/** Build a whitespace-collapsed string of the page's visible text, with a map
 *  from each character back to its (text node, offset) in the DOM. */
function buildIndex(): { text: string; map: CharPos[] } {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const el = node.parentElement;
      if (!el) return NodeFilter.FILTER_REJECT;
      const tag = el.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA') {
        return NodeFilter.FILTER_REJECT;
      }
      if (el.closest(`#${HOST_ID}`)) return NodeFilter.FILTER_REJECT;
      if (el.closest('[contenteditable=""],[contenteditable="true"]')) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  let text = '';
  const map: CharPos[] = [];
  let prevSpace = true; // trims leading whitespace
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const t = node as Text;
    const v = t.nodeValue ?? '';
    for (let i = 0; i < v.length; i++) {
      const isWs = /\s/.test(v[i]);
      if (isWs) {
        if (prevSpace) continue;
        text += ' ';
        map.push({ node: t, offset: i });
        prevSpace = true;
      } else {
        text += v[i];
        map.push({ node: t, offset: i });
        prevSpace = false;
      }
    }
  }
  return { text, map };
}

function makeMarker(target: MarkTarget, onClick: (t: MarkTarget) => void): HTMLSpanElement {
  const marker = document.createElement('span');
  marker.setAttribute(MARKER_ATTR, target.id);
  marker.setAttribute('role', 'button');
  marker.setAttribute('aria-label', 'View note');
  marker.title = 'View this note';
  marker.textContent = '📝';
  Object.assign(marker.style, {
    cursor: 'pointer',
    fontSize: '0.8em',
    margin: '0 1px',
    verticalAlign: 'super',
    userSelect: 'none',
    display: 'inline',
    lineHeight: '1',
  } as CSSStyleDeclaration);
  // Don't let the page's selection logic (or ours) treat this as text.
  marker.addEventListener('mousedown', (e) => e.stopPropagation());
  marker.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(target);
  });
  return marker;
}

function insertMarkerAt(pos: CharPos, marker: HTMLSpanElement): void {
  try {
    const range = document.createRange();
    const offset = Math.min(pos.offset + 1, pos.node.length);
    range.setStart(pos.node, offset);
    range.collapse(true);
    range.insertNode(marker);
  } catch {
    /* tricky DOM — skip this one */
  }
}

/** Insert a marker after the first (non-overlapping) match of each target. */
export function applyMarkers(targets: MarkTarget[], onClick: (t: MarkTarget) => void): void {
  clearMarkers();
  if (!targets.length || !document.body) return;

  const { text, map } = buildIndex();
  const haystack = text.toLowerCase();

  const inserts: { endPos: CharPos; startIdx: number; target: MarkTarget }[] = [];
  const used: Array<[number, number]> = [];

  for (const target of targets) {
    const needle = collapseWs(target.quote).toLowerCase();
    if (needle.length < 2) continue;

    // First occurrence that doesn't overlap a match we've already claimed.
    let from = 0;
    let idx = haystack.indexOf(needle, from);
    while (idx !== -1) {
      const end = idx + needle.length - 1;
      if (!used.some(([s, e]) => idx <= e && end >= s)) break;
      from = idx + 1;
      idx = haystack.indexOf(needle, from);
    }
    if (idx === -1) continue;

    const end = idx + needle.length - 1;
    used.push([idx, end]);
    inserts.push({ endPos: map[end], startIdx: idx, target });
  }

  // Insert from last to first so earlier (node, offset) positions stay valid
  // after each DOM mutation.
  inserts.sort((a, b) => b.startIdx - a.startIdx);
  for (const ins of inserts) {
    insertMarkerAt(ins.endPos, makeMarker(ins.target, onClick));
  }
}

/** Locate a quote on the page and return a Range covering it, or null. */
function findQuoteRange(quote: string): Range | null {
  const needle = collapseWs(quote).toLowerCase();
  if (needle.length < 2 || !document.body) return null;

  const { text, map } = buildIndex();
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

const FLASH_ATTR = 'data-rn-flash';

/** Briefly paint boxes over a range so the reader's eye lands on it. Uses
 *  absolutely positioned overlays, so the page's own DOM is never modified. */
function flashRange(range: Range): void {
  document.querySelectorAll(`[${FLASH_ATTR}]`).forEach((el) => el.remove());
  const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
  const overlays: HTMLElement[] = [];
  for (const r of rects) {
    const box = document.createElement('div');
    box.setAttribute(FLASH_ATTR, '1');
    Object.assign(box.style, {
      position: 'absolute',
      left: `${r.left + window.scrollX}px`,
      top: `${r.top + window.scrollY}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      backgroundColor: 'rgba(253, 224, 71, 0.75)',
      borderRadius: '2px',
      pointerEvents: 'none',
      zIndex: '2147483646',
      transition: 'opacity 0.5s ease',
    } as CSSStyleDeclaration);
    document.body.appendChild(box);
    overlays.push(box);
  }
  window.setTimeout(() => overlays.forEach((o) => (o.style.opacity = '0')), 1800);
  window.setTimeout(() => overlays.forEach((o) => o.remove()), 2400);
}

/**
 * Scroll the page to a saved quote and flash it. Returns false if the text
 * can't be found in this document (e.g. the page changed, or it's in a frame
 * this script isn't running in).
 */
export function scrollToQuote(quote: string): boolean {
  const range = findQuoteRange(quote);
  if (!range) return false;

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

  const target = rect.top + window.scrollY - window.innerHeight / 3;
  window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  // Let the smooth scroll settle before measuring for the flash overlay.
  window.setTimeout(() => {
    const fresh = findQuoteRange(quote);
    if (fresh) flashRange(fresh);
  }, 450);
  return true;
}
