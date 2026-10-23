/**
 * LWW admission decision. Ordering must compare like clocks: the incoming
 * item's `updatedAt` is a client-clock value, so it is judged against the
 * stored client-clock stamp when one exists. Rows written before client
 * stamping (null) fall back to the server-stamped comparison.
 */
export function shouldAcceptSyncWrite(
  existingClientUpdatedAtMs: number | null,
  existingServerUpdatedAtMs: number,
  incomingUpdatedAt: number,
): boolean {
  if (existingClientUpdatedAtMs === null) {
    return incomingUpdatedAt > existingServerUpdatedAtMs;
  }
  return incomingUpdatedAt > existingClientUpdatedAtMs;
}
