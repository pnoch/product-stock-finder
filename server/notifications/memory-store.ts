import type { MemoryEvent, NotificationConfig, NotificationEvent } from "./types";

export const memoryConfigs = new Map<
  string,
  { config: NotificationConfig; userId: number | null }
>();
export const memoryEvents = new Map<string, MemoryEvent>();
export const memoryDeliveries = new Map<string, Set<string>>();

export function deliveryCount(eventId: string): number {
  let count = 0;
  for (const delivered of memoryDeliveries.values()) {
    if (delivered.has(eventId)) count += 1;
  }
  return count;
}

export function clearNotificationsForTests(): void {
  memoryConfigs.clear();
  memoryEvents.clear();
  memoryDeliveries.clear();
}

export function listMemoryConfigDevices(): Array<{
  deviceId: string;
  userId: number | null;
}> {
  return [...memoryConfigs.entries()].map(([deviceId, entry]) => ({
    deviceId,
    userId: entry.userId,
  }));
}

export function removeMemoryDevice(deviceId: string): void {
  memoryConfigs.delete(deviceId);
  memoryDeliveries.delete(deviceId);
  for (const [id, event] of memoryEvents) {
    if (event.deviceId === deviceId) memoryEvents.delete(id);
  }
}

export function stripScope(event: MemoryEvent): NotificationEvent {
  return {
    id: event.id,
    type: event.type,
    title: event.title,
    body: event.body,
    alertId: event.alertId,
    watchId: event.watchId,
    reminderId: event.reminderId,
    productId: event.productId,
    distributorId: event.distributorId,
    targetPrice: event.targetPrice,
    currency: event.currency,
    triggeredPrice: event.triggeredPrice,
    createdAt: event.createdAt,
  };
}
