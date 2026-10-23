import { asc } from "drizzle-orm";
import { deviceNotificationConfigs } from "../../drizzle/schema";
import { getDb } from "../db";
import type { NotificationConfig } from "./types";
import { rowToConfig } from "./mappers";
import {
  createHistoryLookup,
  createPriceLookup,
  type HistoryLookup,
  type PriceLookup,
} from "./build-events";
import { evaluateMemory } from "./evaluate-memory";
import { evaluateConfigDb, evaluateUserDb } from "./evaluate-db";

export async function evaluateNotifications(now: number): Promise<void> {
  // One memoized price lookup per tick: every device evaluation shares it, so
  // the same (distributor, model) row is read at most once per tick.
  const getPrice = createPriceLookup();
  // Same for pooled history: the anomaly guard reads the same (distributors,
  // model) history per alert, so cache it per tick too.
  const getHistory = createHistoryLookup();
  const db = await getDb();
  if (!db) {
    await evaluateMemory(now, getPrice, getHistory);
    return;
  }
  // Paged: device rows are unbounded while a tick must stay short. New rows
  // inserted mid-tick order after the cursor and are picked up next tick.
  const PAGE_SIZE = 500;
  let offset = 0;
  for (;;) {
    const rows = await db
      .select()
      .from(deviceNotificationConfigs)
      .orderBy(asc(deviceNotificationConfigs.deviceId))
      .limit(PAGE_SIZE)
      .offset(offset);
    if (rows.length === 0) break;
    await evaluateConfigPage(db, rows, now, getPrice, getHistory);
    if (rows.length < PAGE_SIZE) break;
    offset += rows.length;
  }
}

async function evaluateConfigPage(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  rows: {
    deviceId: string;
    userId: number | null;
    alerts: unknown;
    stockWatches: unknown;
    dateReminders: unknown;
    quietHours?: unknown;
  }[],
  now: number,
  getPrice: PriceLookup,
  getHistory: HistoryLookup,
): Promise<void> {
  const anonDevices: { deviceId: string; config: NotificationConfig }[] = [];
  const userDevices = new Map<
    number,
    { deviceId: string; config: NotificationConfig }[]
  >();
  for (const row of rows) {
    const config = rowToConfig(row);
    if (row.userId) {
      const list = userDevices.get(row.userId) ?? [];
      list.push({ deviceId: row.deviceId, config });
      userDevices.set(row.userId, list);
    } else {
      anonDevices.push({ deviceId: row.deviceId, config });
    }
  }
  // Isolate each device/user: one persistently failing config must not abort
  // the whole tick (which would also skip every purge job the warmer runs after
  // this, causing unbounded table growth).
  for (const { deviceId, config } of anonDevices) {
    await evaluateConfigDb(db, deviceId, config, now, getPrice, getHistory).catch(
      (e) => console.error(`[notifications] device ${deviceId} evaluation failed`, e),
    );
  }
  for (const [userId, devices] of userDevices) {
    await evaluateUserDb(db, userId, devices, now, getPrice, getHistory).catch(
      (e) => console.error(`[notifications] user ${userId} evaluation failed`, e),
    );
  }
}
