/**
 * Geometry for the Team DNA radial, shared by the projector visualisation and
 * the PNG export card so the exported image is the same shape the room saw.
 */

/**
 * A rounded wedge from the inner core out to `reach`, centred on `angle`.
 *
 * Takes cx and cy separately because the canvas is wider than it is tall — the
 * value labels sit outside the outer ring and need horizontal room.
 */
export function petalPath(
  cx: number,
  cy: number,
  angle: number,
  slice: number,
  inner: number,
  reach: number,
): string {
  const gap = slice * 0.11;
  const a0 = angle - slice / 2 + gap;
  const a1 = angle + slice / 2 - gap;

  const p = (radius: number, a: number) =>
    `${cx + Math.cos(a) * radius} ${cy + Math.sin(a) * radius}`;

  return [
    `M ${p(inner, a0)}`,
    `L ${p(reach, a0)}`,
    `A ${reach} ${reach} 0 0 1 ${p(reach, a1)}`,
    `L ${p(inner, a1)}`,
    `A ${inner} ${inner} 0 0 0 ${p(inner, a0)}`,
    "Z",
  ].join(" ");
}

export function anchorFor(cos: number): "start" | "middle" | "end" {
  if (cos > 0.35) return "start";
  if (cos < -0.35) return "end";
  return "middle";
}

export const RING_STEPS = [0.25, 0.5, 0.75, 1];
