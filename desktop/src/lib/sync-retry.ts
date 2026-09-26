/**
 * Retries a failed sync when the app returns to the foreground, mirroring the
 * mobile handler in `app/_layout.tsx`. A sync that failed while offline stayed
 * failed on the desktop until the next storage change or a manual "Sync now",
 * because the engine itself has no retry timer.
 *
 * Only a recorded failure triggers a retry, and at most once a second so a
 * burst of focus/visibility events cannot stack syncs.
 */
export interface SyncRetryDeps {
  isSignedIn: () => boolean;
  getMeta: () => Promise<{ lastSyncError?: string | null } | null>;
  syncNow: () => void;
}

export function createForegroundSyncRetry(
  deps: SyncRetryDeps,
  now: () => number = Date.now,
): () => Promise<void> {
  let lastActive = 0;
  return async function onForeground(): Promise<void> {
    const at = now();
    if (at - lastActive < 1000) return;
    lastActive = at;
    if (!deps.isSignedIn()) return;
    try {
      const meta = await deps.getMeta();
      if (meta?.lastSyncError) deps.syncNow();
    } catch {
      // A storage read failure must not reject unhandled in a focus handler.
    }
  };
}
