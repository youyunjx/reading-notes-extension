import { useEffect, useRef, useState } from 'react';
import type { AnnotationTool, PdfAnnotation } from '../lib/types';

interface Props {
  pageNumber: number;
  /** Rendered page size in CSS pixels. */
  width: number;
  height: number;
  /** Current zoom, used to scale text to match the page. */
  scale: number;
  tool: AnnotationTool;
  color: string;
  annotations: PdfAnnotation[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (a: Omit<PdfAnnotation, 'id' | 'fileUrl' | 'createdAt' | 'updatedAt'>) => void;
  onMove: (id: string, x: number, y: number) => void;
  onEditText: (id: string, text: string) => void;
}

/** A drag in progress, in normalised page coordinates. */
interface Drag {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const MIN_SIZE = 0.004; // ignore accidental micro-drags
const DEFAULT_FONT_PT = 14;

export function AnnotationLayer({
  pageNumber,
  width,
  height,
  scale,
  tool,
  color,
  annotations,
  selectedId,
  onSelect,
  onCreate,
  onMove,
  onEditText,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const movingRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const drawing = tool !== 'select';

  /** Pointer position as a 0–1 fraction of the page. */
  function norm(e: { clientX: number; clientY: number }) {
    const el = ref.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
    };
  }

  // --- creating a new shape by dragging -----------------------------------
  function onPointerDown(e: React.PointerEvent) {
    if (!drawing) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = norm(e);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const p = norm(e);
    setDrag((d) => (d ? { ...d, x1: p.x, y1: p.y } : d));
  }

  function onPointerUp() {
    if (!drag) return;
    const { x0, y0, x1, y1 } = drag;
    setDrag(null);
    if (tool === 'select') return; // narrows `tool` to a drawable shape below

    if (tool === 'arrow') {
      if (Math.abs(x1 - x0) < MIN_SIZE && Math.abs(y1 - y0) < MIN_SIZE) return;
      onCreate({ page: pageNumber, type: 'arrow', x: x0, y: y0, w: x1 - x0, h: y1 - y0, color });
      return;
    }

    const x = Math.min(x0, x1);
    const y = Math.min(y0, y1);
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);

    if (tool === 'text') {
      // A click (rather than a drag) still makes a sensibly sized text box.
      const boxW = w < MIN_SIZE ? 0.3 : w;
      const boxH = h < MIN_SIZE ? (DEFAULT_FONT_PT * 1.6) / (height / scale) : h;
      onCreate({
        page: pageNumber,
        type: 'text',
        x,
        y,
        w: boxW,
        h: boxH,
        text: '',
        fontSize: DEFAULT_FONT_PT,
        color,
      });
      return;
    }

    if (w < MIN_SIZE || h < MIN_SIZE) return;
    onCreate({ page: pageNumber, type: tool, x, y, w, h, color });
  }

  // --- moving an existing shape -------------------------------------------
  useEffect(() => {
    function move(e: PointerEvent) {
      const m = movingRef.current;
      const el = ref.current;
      if (!m || !el) return;
      const r = el.getBoundingClientRect();
      onMove(m.id, (e.clientX - r.left) / r.width - m.dx, (e.clientY - r.top) / r.height - m.dy);
    }
    function up() {
      movingRef.current = null;
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [onMove]);

  function startMove(e: React.PointerEvent, a: PdfAnnotation) {
    if (drawing || editingId === a.id) return;
    e.stopPropagation();
    onSelect(a.id);
    const p = norm(e);
    movingRef.current = { id: a.id, dx: p.x - a.x, dy: p.y - a.y };
  }

  const px = (nx: number) => nx * width;
  const py = (ny: number) => ny * height;

  const preview = drag
    ? {
        x: Math.min(drag.x0, drag.x1),
        y: Math.min(drag.y0, drag.y1),
        w: Math.abs(drag.x1 - drag.x0),
        h: Math.abs(drag.y1 - drag.y0),
      }
    : null;

  return (
    <div
      ref={ref}
      className={`pdf-annots${drawing ? ' drawing' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Shapes (SVG so strokes stay crisp at any zoom) */}
      <svg className="pdf-annots-svg" width={width} height={height}>
        <defs>
          <marker
            id={`jot-arrow-${pageNumber}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
          </marker>
        </defs>

        {annotations.map((a) => {
          const on = a.id === selectedId;
          if (a.type === 'rect') {
            return (
              <rect
                key={a.id}
                x={px(a.x)}
                y={py(a.y)}
                width={px(a.w)}
                height={py(a.h)}
                fill="none"
                stroke={a.color}
                strokeWidth={on ? 3 : 2}
                className="pdf-annot-hit"
                onPointerDown={(e) => startMove(e, a)}
              />
            );
          }
          if (a.type === 'ellipse') {
            return (
              <ellipse
                key={a.id}
                cx={px(a.x + a.w / 2)}
                cy={py(a.y + a.h / 2)}
                rx={px(a.w / 2)}
                ry={py(a.h / 2)}
                fill="none"
                stroke={a.color}
                strokeWidth={on ? 3 : 2}
                className="pdf-annot-hit"
                onPointerDown={(e) => startMove(e, a)}
              />
            );
          }
          if (a.type === 'arrow') {
            return (
              <line
                key={a.id}
                x1={px(a.x)}
                y1={py(a.y)}
                x2={px(a.x + a.w)}
                y2={py(a.y + a.h)}
                stroke={a.color}
                strokeWidth={on ? 3 : 2}
                markerEnd={`url(#jot-arrow-${pageNumber})`}
                className="pdf-annot-hit"
                onPointerDown={(e) => startMove(e, a)}
              />
            );
          }
          return null;
        })}

        {/* Live preview while dragging */}
        {preview && tool === 'rect' && (
          <rect
            x={px(preview.x)}
            y={py(preview.y)}
            width={px(preview.w)}
            height={py(preview.h)}
            fill="none"
            stroke={color}
            strokeDasharray="4 3"
            strokeWidth={2}
          />
        )}
        {preview && tool === 'ellipse' && (
          <ellipse
            cx={px(preview.x + preview.w / 2)}
            cy={py(preview.y + preview.h / 2)}
            rx={px(preview.w / 2)}
            ry={py(preview.h / 2)}
            fill="none"
            stroke={color}
            strokeDasharray="4 3"
            strokeWidth={2}
          />
        )}
        {drag && tool === 'arrow' && (
          <line
            x1={px(drag.x0)}
            y1={py(drag.y0)}
            x2={px(drag.x1)}
            y2={py(drag.y1)}
            stroke={color}
            strokeDasharray="4 3"
            strokeWidth={2}
          />
        )}
      </svg>

      {/* Text boxes are real DOM so they can be typed into */}
      {annotations
        .filter((a) => a.type === 'text')
        .map((a) => (
          <div
            key={a.id}
            className={`pdf-annot-text${a.id === selectedId ? ' selected' : ''}`}
            style={{
              left: px(a.x),
              top: py(a.y),
              width: px(a.w),
              minHeight: py(a.h),
              color: a.color,
              fontSize: (a.fontSize ?? DEFAULT_FONT_PT) * scale,
            }}
            onPointerDown={(e) => startMove(e, a)}
            onDoubleClick={() => setEditingId(a.id)}
          >
            {editingId === a.id ? (
              <textarea
                autoFocus
                defaultValue={a.text ?? ''}
                style={{ color: a.color, fontSize: (a.fontSize ?? DEFAULT_FONT_PT) * scale }}
                onBlur={(e) => {
                  onEditText(a.id, e.target.value);
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur();
                }}
                onPointerDown={(e) => e.stopPropagation()}
              />
            ) : (
              <span>{a.text || 'Double-click to edit'}</span>
            )}
          </div>
        ))}
    </div>
  );
}

/** New text boxes open straight into edit mode. */
export const TEXT_DEFAULT_FONT_PT = DEFAULT_FONT_PT;
