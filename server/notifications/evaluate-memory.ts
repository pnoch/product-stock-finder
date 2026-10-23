import { sendPushForDevice, sendPushForUser } from "../push-notifications";
import type { NotificationConfig, NotificationEvent } from "./types";
import {
  deliveryCount,
  memoryConfigs,
  memoryDeliveries,
  memoryEvents,
} from "./memory-store";
import { draftToEvent } from "./mappers";
import {
  buildEvents,
  dedupKeyFor,
  type HistoryLookup,
  type PriceLookup,
} from "./build-events";
import {
  buildDigestDraft,
  holdForDigest,
  scopeKeyForDevice,
  scopeKeyForUser,
  takeDigestHeld,
} from "./digest";
import { aggregateConfigs } from "./aggregate-configs";
import { isEventBlocking } from "./event-blocking";

export async function evaluateMemory(
  now: number,
  getPrice: PriceLookup,
  getHistory: HistoryLookup,
): Promise<void> {
  const anonDevices: { deviceId: string; config: NotificationConfig }[] = [];
  const userDevices = new Map<
    number,
    { deviceId: string; config: NotificationConfig }[]
  >();
  for (const [deviceId, entry] of memoryConfigs) {
    if (entry.userId) {
      const list = userDevices.get(entry.userId) ?? [];
      list.push({ deviceId, config: entry.config });
      userDevices.set(entry.userId, list);
    } else {
      anonDevices.push({ deviceId, config: entry.config });
    }
  }
  for (const { deviceId, config } of anonDevices) {
    await evaluateAnonMemory(deviceId, config, now, getPrice, getHistory);
  }
  for (const [userId, devices] of userDevices) {
    await evaluateUserMemory(userId, devices, now, getPrice, getHistory);
  }
}

async function evaluateAnonMemory(
  deviceId: string,
  config: NotificationConfig,
  now: number,
  getPrice: PriceLookup,
  getHistory: HistoryLookup,
): Promise<void> {
  const delivered = memoryDeliveries.get(deviceId) ?? new Set<string>();
  const blocked = new Set(
    [...memoryEvents.values()]
      .filter((e) => e.deviceId === deviceId)
      .filter((e) =>
        isEventBlocking(e.createdAt, delivered.has(e.id) ? 1 : 0, 1, now),
      )
      .map((e) => dedupKeyFor(e)),
  );
  const drafts = await buildEvents(config, now, getPrice, getHistory);
  const scopeKey = scopeKeyForDevice(deviceId);
  const holdable = drafts.filter((d) => !blocked.has(d.dedupKey));
  if (holdForDigest(scopeKey, [config], holdable, now)) return;
  const held = takeDigestHeld(scopeKey);
  let toDeliver = drafts;
  if (held.length > 0) {
    const heldDrafts = [
      ...new Map([...held, ...drafts].map((d) => [d.dedupKey, d])).values(),
    ];
    const digest = buildDigestDraft(
      heldDrafts,
      scopeKey,
      now,
      config.quietHours?.utcOffsetMinutes,
    );
    toDeliver =
      digest && !blocked.has(digest.dedupKey) ? [digest] : [...held, ...drafts];
  }
  const added: NotificationEvent[] = [];
  const seen = new Set<string>();
  for (const draft of toDeliver) {
    if (blocked.has(draft.dedupKey) || seen.has(draft.dedupKey)) continue;
    seen.add(draft.dedupKey);
    const event = {
      ...draftToEvent(draft),
      userId: null,
      deviceId,
      dedupKey: draft.dedupKey,
    };
    memoryEvents.set(event.id, event);
    added.push(event);
  }
  if (added.length > 0) void sendPushForDevice(deviceId, added);
}

async function evaluateUserMemory(
  userId: number,
  devices: { deviceId: string; config: NotificationConfig }[],
  now: number,
  getPrice: PriceLookup,
  getHistory: HistoryLookup,
): Promise<void> {
  const boundCount = devices.length;
  const config = aggregateConfigs(devices.map((d) => d.config));
  const blocked = new Set(
    [...memoryEvents.values()]
      .filter((e) => e.userId === userId)
      .filter((e) =>
        isEventBlocking(e.createdAt, deliveryCount(e.id), boundCount, now),
      )
      .map((e) => dedupKeyFor(e)),
  );
  const drafts = await buildEvents(config, now, getPrice, getHistory);
  const scopeKey = scopeKeyForUser(userId);
  const holdable = drafts.filter((d) => !blocked.has(d.dedupKey));
  if (
    holdForDigest(
      scopeKey,
      devices.map((d) => d.config),
      holdable,
      now,
    )
  )
    return;
  const held = takeDigestHeld(scopeKey);
  let toDeliver = drafts;
  if (held.length > 0) {
    const heldDrafts = [
      ...new Map([...held, ...drafts].map((d) => [d.dedupKey, d])).values(),
    ];
    const digest = buildDigestDraft(
      heldDrafts,
      scopeKey,
      now,
      config.quietHours?.utcOffsetMinutes,
    );
    toDeliver =
      digest && !blocked.has(digest.dedupKey) ? [digest] : [...held, ...drafts];
  }
  const added: NotificationEvent[] = [];
  const seen = new Set<string>();
  for (const draft of toDeliver) {
    if (blocked.has(draft.dedupKey) || seen.has(draft.dedupKey)) continue;
    seen.add(draft.dedupKey);
    const event = {
      ...draftToEvent(draft),
      userId,
      deviceId: null,
      dedupKey: draft.dedupKey,
    };
    memoryEvents.set(event.id, event);
    added.push(event);
  }
  if (added.length > 0) void sendPushForUser(userId, added);
}
