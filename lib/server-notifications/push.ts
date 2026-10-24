import { createTRPCClient } from "../trpc";
import { withTimeout } from "../with-timeout";

// Larger than the server's 5s webhook POST budget: a shorter client deadline
// reports a false failure while the send is still in flight.
const WEBHOOK_TEST_TIMEOUT_MS = 8_000;

export async function testWebhook(
  url: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = createTRPCClient();
    // withTimeout resolves null on timeout, so coalesce it into a failure result
    // (null would otherwise be an invalid return for this function).
    return (
      (await withTimeout(
        client.notifications.testWebhook.mutate({ url }),
        WEBHOOK_TEST_TIMEOUT_MS,
      )) ?? { ok: false, error: "Could not reach the server. Try again." }
    );
  } catch {
    return { ok: false, error: "Could not reach the server. Try again." };
  }
}

export interface PushStatusDevice {
  deviceId: string;
  label: string | null;
  platform: string | null;
  hasToken: boolean;
  outcome: {
    status: "ok" | "error";
    error: string | null;
    sentAt: number;
    eventCount: number;
    ticketId: string | null;
  } | null;
}

export async function fetchPushStatusAll(): Promise<PushStatusDevice[]> {
  try {
    const client = createTRPCClient();
    const res = await client.notifications.pushStatusAll.query({});
    return res.devices;
  } catch {
    return [];
  }
}

export async function sendTestPush(): Promise<PushStatusDevice["outcome"]> {
  const client = createTRPCClient();
  return client.notifications.sendTestPush.mutate({});
}

export function pushErrorHelpText(error: string | null): string {
  switch (error) {
    case "DeviceNotRegistered":
      return "This device unregistered from push — reopen the app to reconnect.";
    case "MessageTooBig":
      return "Notification payload too large — please report this as a bug.";
    case "MessageRateExceeded":
      return "Sending too fast — wait a minute and retry.";
    case "InvalidCredentials":
      return "Server push credentials are invalid — contact support.";
    case null:
    case undefined:
      return "Delivered.";
    default:
      return `Couldn't confirm delivery (${error}). Try again.`;
  }
}
