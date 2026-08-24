export function findNearestIndex(x: number, count: number): number {
  if (count <= 1) return 0;
  const clamped = Math.max(0, Math.min(x, 100));
  const index = Math.ceil((clamped / 100) * (count - 1) - 0.5);
  return Math.max(0, Math.min(index, count - 1));
}

export function indexForLocationX(
  locationX: number,
  width: number,
  padL: number,
  padR: number,
  count: number,
): number {
  const usable = width - padL - padR;
  if (usable <= 0) return 0;
  const percent = ((locationX - padL) / usable) * 100;
  return findNearestIndex(percent, count);
}

export function nearestByX<T extends { x: number }>(
  coords: T[],
  targetX: number,
): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const c of coords) {
    const dist = Math.abs(c.x - targetX);
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}
