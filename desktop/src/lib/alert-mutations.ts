export type AlertPatch = Record<string, unknown>;

export interface AlertMutations {
  upserts: { id: string; patch: AlertPatch }[];
  removes: string[];
}

/**
 * Diffs the renderer's previous and next alert arrays into per-item field
 * patches. Only changed fields are sent, so the Rust side never has to guess
 * between a stale snapshot and a deliberate re-arm; a field removed in `next`
 * becomes `null` (Rust removes it).
 */
export function computeAlertMutations(
  last: Record<string, unknown>[],
  next: Record<string, unknown>[],
): AlertMutations {
  const lastById = new Map(last.map((a) => [String(a.id), a]));
  const nextIds = new Set(next.map((a) => String(a.id)));
  const removes = [...lastById.keys()].filter((id) => !nextIds.has(id));
  const upserts: { id: string; patch: AlertPatch }[] = [];
  for (const item of next) {
    const id = String(item.id);
    const prev = lastById.get(id);
    if (!prev) {
      const { id: _omit, ...rest } = item;
      upserts.push({ id, patch: rest });
      continue;
    }
    const patch: AlertPatch = {};
    const keys = new Set([...Object.keys(prev), ...Object.keys(item)]);
    for (const key of keys) {
      if (key === "id") continue;
      const before = prev[key];
      const after = item[key];
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      patch[key] = after === undefined ? null : after;
    }
    if (Object.keys(patch).length > 0) upserts.push({ id, patch });
  }
  return { upserts, removes };
}
