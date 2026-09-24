export function formatRelativeTime(ts: number): string {
  if (!Number.isFinite(ts)) return "—";
  const diff = Date.now() - ts;
  if (diff < 0) return "Just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

/**
 * Human-friendly device last-seen label. `platformLabel`/`formatLastSeen` were
 * mobile-only; the desktop device list showed an absolute date instead, so
 * recency was lost. Shared here so both platforms render the same string.
 */
export function formatLastSeen(lastSeenAt: number, now: number = Date.now()): string {
  if (!lastSeenAt) return "last seen unknown";
  const diff = Math.max(0, now - lastSeenAt);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "last seen just now";
  if (minutes < 60) return `last seen ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `last seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `last seen ${days}d ago`;
}
