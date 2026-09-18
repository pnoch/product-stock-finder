/**
 * Bounded-concurrency map. Runs `fn` over `items` with at most `concurrency`
 * in flight, preserving input order in the result.
 *
 * Used to parallelize per-item DB round trips (e.g. a 200-item sync push, which
 * was previously 400 serialized queries) without opening an unbounded number of
 * connections.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const slots = Math.max(1, Math.floor(concurrency) || 1);
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!, index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(slots, items.length) }, () => worker()),
  );
  return results;
}
