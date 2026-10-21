export function OfflineBanner({
  queuedCount,
  isOffline,
}: {
  queuedCount: number;
  isOffline: boolean;
}) {
  if (!isOffline || queuedCount <= 0) return null;
  return (
    <div
      className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm font-semibold"
      role="alert"
    >
      Offline — {queuedCount} edit{queuedCount === 1 ? "" : "s"} queued. Will
      sync when back online.
    </div>
  );
}
