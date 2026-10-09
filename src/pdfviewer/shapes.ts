/**
 * Shape geometry shared by the on-screen renderer and the PDF exporter, so the
 * two can't drift apart.
 */

/** The checkmark's three points, as fractions of its bounding box. */
const TICK = [
  [0.12, 0.55],
  [0.40, 0.84],
  [0.88, 0.16],
] as const;

export interface Point {
  x: number;
  y: number;
}

/**
 * The three points of a tick inside the box (x, y, w, h).
 * Works in whatever unit the box is given in — normalised, CSS px, or PDF pt.
 */
export function tickPoints(x: number, y: number, w: number, h: number): Point[] {
  return TICK.map(([fx, fy]) => ({ x: x + fx * w, y: y + fy * h }));
}

/** Default side of a tick dropped with a single click, as a fraction of page width. */
export const TICK_DEFAULT_W = 0.04;
