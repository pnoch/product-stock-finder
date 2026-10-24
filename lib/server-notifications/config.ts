import { createTRPCClient } from "../trpc";
import { withTimeout } from "../with-timeout";
import { MAX_UPLOAD_HEALTH_EVENTS } from "../../shared/const";
import type {
  NotificationConfig,
  NotificationEvent,
} from "../../server/notifications";

const TIMEOUT_MS = 4000;

export async function uploadNotificationConfig(
  config: NotificationConfig,
  healthEvents?: {
    id: string;
    distributorId: string;
    distributorName: string;
    status: "blocked" | "error";
    /** Separates an alert from its recovery in the server's health dedup key. */
    kind?: "alert" | "recovery";
    title: string;
    body: string;
    createdAt: number;
  }[],
): Promise<boolean> {
  try {
    const client = createTRPCClient();
    const result = await withTimeout(
      client.notifications.uploadConfig.mutate({
        ...config,
        healthEvents,
      }).then(() => true as const),
      TIMEOUT_MS,
    );
    return result === true;
  } catch {
    return false;
  }
}

// Serializes the read-modify-write below. A health sweep fires one upload per
// distributor without awaiting, so parallel calls all read the same base list
// and each wrote a list containing only its own event — dropping the rest.
let healthBufferQueue: Promise<unknown> = Promise.resolve();

export async function uploadHealthEventToServer(event: {
  id?: string;
  distributorId: string;
  distributorName: string;
  status: "blocked" | "error";
  kind?: "alert" | "recovery";
  title: string;
  body: string;
  createdAt: number;
}): Promise<void> {
  const run = async () => {
    const { getPendingHealthEvents, savePendingHealthEvents } = await import("../storage");
    const pending = await getPendingHealthEvents();
    pending.push(event);
    // Bound the buffer at the upload cap (keep the newest): it is persisted to
    // AsyncStorage, and the server rejects uploads larger than the cap — so an
    // uncapped buffer would grow forever and then fail to upload at all.
    const trimmed =
      pending.length > MAX_UPLOAD_HEALTH_EVENTS
        ? pending.slice(pending.length - MAX_UPLOAD_HEALTH_EVENTS)
        : pending;
    await savePendingHealthEvents(trimmed);
  };
  const next = healthBufferQueue.then(run, run);
  healthBufferQueue = next.catch(() => {});
  return next;
}

export async function pullNotificationEvents(): Promise<NotificationEvent[]> {
  try {
    const client = createTRPCClient();
    const result = await withTimeout(
      client.notifications.pull.query({}),
      TIMEOUT_MS,
    );
    return result?.events ?? [];
  } catch {
    return [];
  }
}
