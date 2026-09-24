export const CLEANUP_TIMEOUT_MS = 20_000;

export interface DeviceCleanupClient {
  devices: {
    cleanupStale: {
      mutate: () => Promise<{ removed: number }>;
    };
  };
}

/**
 * Removes device bindings that have not been seen for 30+ days. Mobile calls
 * the equivalent on sign-in; without it the desktop device list accumulates
 * stale devices forever (the server only purges revoked-device rows, not stale
 * bindings — a client has to ask).
 */
export async function cleanupStaleDevices(
  client: DeviceCleanupClient,
  timeoutMs: number = CLEANUP_TIMEOUT_MS,
): Promise<number> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      client.devices.cleanupStale.mutate(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("device cleanup timeout")), timeoutMs);
      }),
    ]);
    return result?.removed ?? 0;
  } catch {
    return 0;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
