export function findNearestIndex(x: number, count: number): number {
  if (count <= 1) return 0;
  const clamped = Math.max(0, Math.min(x, 100));
  const index = Math.ceil((clamped / 100) * (count - 1) - 0.5);
  return Math.max(0, Math.min(index, count - 1));
}
