import type { PdfAnnotation } from '../lib/types';

/** #RRGGBB -> 0–1 RGB components. Falls back to black on anything unexpected. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

/**
 * Draw annotations into the PDF itself and return the new bytes.
 *
 * pdf-lib is imported dynamically so its ~1.5 MB only loads when someone
 * actually exports — the viewer itself stays light. Everything runs locally.
 *
 * Coordinate spaces differ: our annotations are normalised 0–1 from the page's
 * TOP-left, while PDF uses points from the BOTTOM-left, so the y axis is
 * flipped here.
 */
export async function buildAnnotatedPdf(
  original: Uint8Array,
  annotations: PdfAnnotation[],
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');

  const pdf = await PDFDocument.load(original);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  for (const a of annotations) {
    const page = pages[a.page - 1];
    if (!page) continue;

    const { width: W, height: H } = page.getSize();
    const { r, g, b } = hexToRgb(a.color);
    const colour = rgb(r, g, b);

    // Convert to PDF points.
    const x = a.x * W;
    const w = a.w * W;
    const h = a.h * H;
    // Top edge of the shape, measured from the bottom of the page.
    const topY = (1 - a.y) * H;

    if (a.type === 'rect') {
      page.drawRectangle({
        x,
        y: topY - h,
        width: w,
        height: h,
        borderColor: colour,
        borderWidth: 1.5,
      });
      continue;
    }

    if (a.type === 'ellipse') {
      page.drawEllipse({
        x: x + w / 2,
        y: topY - h / 2,
        xScale: Math.abs(w / 2),
        yScale: Math.abs(h / 2),
        borderColor: colour,
        borderWidth: 1.5,
      });
      continue;
    }

    if (a.type === 'arrow') {
      const start = { x, y: topY };
      const end = { x: x + w, y: topY - a.h * H };
      page.drawLine({ start, end, color: colour, thickness: 1.5 });

      // Arrowhead: two short lines rotated back from the direction of travel.
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLen = 8;
      for (const spread of [Math.PI * 0.82, -Math.PI * 0.82]) {
        page.drawLine({
          start: end,
          end: {
            x: end.x + headLen * Math.cos(angle + spread),
            y: end.y + headLen * Math.sin(angle + spread),
          },
          color: colour,
          thickness: 1.5,
        });
      }
      continue;
    }

    if (a.type === 'text' && a.text?.trim()) {
      const size = a.fontSize ?? 14;
      const maxWidth = Math.max(w, size * 2);
      // Wrap on spaces so long notes don't run off the page edge.
      const lines: string[] = [];
      let line = '';
      for (const word of a.text.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) lines.push(line);

      lines.forEach((text, i) => {
        page.drawText(text, {
          x,
          // First baseline sits one line below the box's top edge.
          y: topY - size * (0.85 + i * 1.2),
          size,
          font,
          color: colour,
          rotate: degrees(0),
        });
      });
    }
  }

  return pdf.save();
}
