import { useEffect, useRef, useState } from 'react';
import { TextLayer, setLayerDimensions } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Note } from '../lib/types';
import { findQuoteRange, rectsRelativeTo } from './textRange';
import type { RectBox } from './textRange';

interface Props {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  /** Notes anchored to this page. */
  notes: Note[];
  /** Note to briefly flash (when arriving from "Go to" in the side panel). */
  flashNoteId?: string | null;
  onHighlightClick: (note: Note) => void;
}

interface HighlightBox extends RectBox {
  noteId: string;
  title: string;
}

export function PdfPage({
  doc,
  pageNumber,
  scale,
  notes,
  flashNoteId,
  onHighlightClick,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const [renderedAt, setRenderedAt] = useState(0);
  const [boxes, setBoxes] = useState<HighlightBox[]>([]);

  // Reserve the correct space up front so scrolling/lazy-render behaves.
  useEffect(() => {
    let cancelled = false;
    doc.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const vp = page.getViewport({ scale });
      setSize({ w: Math.floor(vp.width), h: Math.floor(vp.height) });
    });
    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber, scale]);

  // Render only when scrolled near the viewport.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setVisible(true)),
      { rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Paint the canvas + text layer.
  useEffect(() => {
    if (!visible || !size) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;

    (async () => {
      const canvas = canvasRef.current;
      const textLayerDiv = textRef.current;
      if (!canvas || !textLayerDiv) return;

      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const renderTask = page.render({
        canvas,
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      });
      task = renderTask;
      try {
        await renderTask.promise;
      } catch {
        return; // cancelled or failed — nothing to draw
      }
      if (cancelled) return;

      // Text layer (selectable text positioned over the canvas).
      // PDF.js v4+ positions glyphs with calc(... * var(--total-scale-factor)),
      // so that variable MUST be set or the text layer drifts out of alignment
      // with the canvas — making selection inaccurate and highlight rectangles
      // land in the wrong place. setLayerDimensions applies the correct sizing.
      textLayerDiv.innerHTML = '';
      const wrap = wrapRef.current;
      if (wrap) {
        wrap.style.setProperty('--total-scale-factor', String(scale));
        wrap.style.setProperty('--scale-factor', String(scale));
      }
      setLayerDimensions(textLayerDiv, viewport);
      const textContent = await page.getTextContent();
      if (cancelled) return;
      const textLayer = new TextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport,
      });
      await textLayer.render();
      if (cancelled) return;
      setRenderedAt(Date.now());
    })();

    return () => {
      cancelled = true;
      try {
        task?.cancel();
      } catch {
        /* already finished */
      }
    };
  }, [doc, pageNumber, scale, visible, size]);

  // Re-measure highlight positions when the window size changes.
  const [resizeTick, setResizeTick] = useState(0);
  useEffect(() => {
    const onResize = () => setResizeTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Position highlight boxes for this page's notes, once text is laid out.
  useEffect(() => {
    const wrap = wrapRef.current;
    const textLayerDiv = textRef.current;
    if (!wrap || !textLayerDiv || !renderedAt) return;

    const next: HighlightBox[] = [];
    for (const note of notes) {
      const range = findQuoteRange(textLayerDiv, note.quote);
      if (!range) continue;
      for (const r of rectsRelativeTo(range, wrap)) {
        next.push({
          ...r,
          noteId: note.id,
          title: note.insight.trim()
            ? `Note: ${note.insight.trim()}`
            : 'Note — click to open',
        });
      }
    }
    setBoxes(next);
  }, [notes, renderedAt, resizeTick]);

  // When arriving from "Go to", scroll to the passage itself (not just the page)
  // once its highlight boxes have been measured.
  useEffect(() => {
    if (!flashNoteId) return;
    const wrap = wrapRef.current;
    const box = boxes.find((b) => b.noteId === flashNoteId);
    if (!wrap || !box) return;
    const top = wrap.getBoundingClientRect().top + window.scrollY + box.top;
    window.scrollTo({
      top: Math.max(0, top - window.innerHeight / 3),
      behavior: 'smooth',
    });
  }, [flashNoteId, boxes]);

  // The text layer sits above the highlights (so text stays selectable), which
  // means it swallows clicks. Hit-test at the page level instead.
  function boxAt(e: React.MouseEvent): HighlightBox | undefined {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const base = wrap.getBoundingClientRect();
    const x = e.clientX - base.left;
    const y = e.clientY - base.top;
    return boxes.find(
      (b) => x >= b.left && x <= b.left + b.width && y >= b.top && y <= b.top + b.height,
    );
  }

  function handleClick(e: React.MouseEvent) {
    // Don't hijack the click while the user is selecting text.
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) return;
    const box = boxAt(e);
    if (!box) return;
    const note = notes.find((n) => n.id === box.noteId);
    if (note) onHighlightClick(note);
  }

  function handleMouseMove(e: React.MouseEvent) {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const box = boxAt(e);
    wrap.style.cursor = box ? 'pointer' : '';
    if (box) wrap.title = box.title;
    else wrap.removeAttribute('title');
  }

  return (
    <div
      className="pdf-page"
      data-page-number={pageNumber}
      ref={wrapRef}
      style={size ? { width: size.w, height: size.h } : { width: 600, height: 800 }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
    >
      <canvas ref={canvasRef} />
      <div className="pdf-highlights">
        {boxes.map((b, i) => (
          <div
            key={`${b.noteId}-${i}`}
            className={`pdf-highlight${flashNoteId === b.noteId ? ' flash' : ''}`}
            style={{ left: b.left, top: b.top, width: b.width, height: b.height }}
          />
        ))}
      </div>
      <div className="textLayer" ref={textRef} />
      <span className="pdf-page-label">{pageNumber}</span>
    </div>
  );
}
