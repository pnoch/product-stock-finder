import { isInQuietHours } from "../../lib/quiet-hours";
import type { AppSettings } from "../../lib/types";
import { digestBuffers } from "./memory-store";
import type { EventDraft, NotificationConfig } from "./types";

// Quiet-hours digest batching for the server warmer. While a scope (device
// or user) sits inside its quiet window, fresh drafts are held in memory
// keyed by dedupKey (latest wins, rebuilt from live prices every tick, so a
// restart only loses the not-yet-flushed window tail). The first tick after
// the window ends flushes one grouped digest; later ticks resume individual
// delivery.

export function scopeKeyForDevice(deviceId: string): string {
  return `d:${deviceId}`;
}

export function scopeKeyForUser(userId: number): string {
  return `u:${userId}`;
}

export function shouldHoldScope(
  configs: NotificationConfig[],
  nowMs: number,
): boolean {
  if (configs.length === 0) return false;
  const now = new Date(nowMs);
  // Every bound config must opt in: a device that never uploaded quiet hours
  // (old client) must not have its notifications delayed.
  return configs.every((c) => {
    const qh = c.quietHours;
    if (!qh?.start || !qh?.end) return false;
    return isInQuietHours({ quietHours: qh } as AppSettings, now);
  });
}

function bufferFor(scopeKey: string): Map<string, EventDraft> {
  let buffer = digestBuffers.get(scopeKey);
  if (!buffer) {
    buffer = new Map();
    digestBuffers.set(scopeKey, buffer);
  }
  return buffer;
}

export function mergeDigestHeld(
  buffer: Map<string, EventDraft>,
  drafts: EventDraft[],
): void {
  for (const draft of drafts) buffer.set(draft.dedupKey, draft);
}

// Returns true when the drafts were buffered (caller must skip insert+push).
export function holdForDigest(
  scopeKey: string,
  configs: NotificationConfig[],
  drafts: EventDraft[],
  nowMs: number,
): boolean {
  if (!shouldHoldScope(configs, nowMs)) return false;
  mergeDigestHeld(bufferFor(scopeKey), drafts);
  return true;
}

export function takeDigestHeld(scopeKey: string): EventDraft[] {
  const buffer = digestBuffers.get(scopeKey);
  if (!buffer || buffer.size === 0) return [];
  digestBuffers.delete(scopeKey);
  return [...buffer.values()];
}

const MAX_DIGEST_LINES = 5;

export function buildDigestDraft(
  held: EventDraft[],
  scopeKey: string,
  nowMs: number,
  // The client's UTC offset (Date.getTimezoneOffset semantics), so the digest
  // day bucket matches the user's calendar day rather than UTC.
  utcOffsetMinutes?: number,
): EventDraft | null {
  if (held.length === 0) return null;
  const localMs =
    typeof utcOffsetMinutes === "number"
      ? nowMs - utcOffsetMinutes * 60_000
      : nowMs;
  const day = new Date(localMs).toISOString().slice(0, 10);
  const lines = held
    .slice(0, MAX_DIGEST_LINES)
    .map((d) => `• ${d.title} — ${d.body}`);
  if (held.length > MAX_DIGEST_LINES) {
    lines.push(`+${held.length - MAX_DIGEST_LINES} more`);
  }
  return {
    id: `digest:${scopeKey}:${day}`,
    type: "digest",
    dedupKey: `digest:${scopeKey}:${day}`,
    title: "📊 Price Digest",
    body: lines.join("\n"),
    payload: { productId: "", digestCount: held.length },
    createdAt: nowMs,
  };
}
