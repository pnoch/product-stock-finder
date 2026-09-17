import webPush from "web-push";

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface WebPushEvent {
  id: string;
  title: string;
  body: string;
  type?: string;
  productId?: string;
  distributorId?: string;
}

let vapidConfigured = false;

// Push endpoints are attacker-supplied (any signed-in user can register a web
// push token), and web-push issues an outbound HTTPS request to that endpoint
// with a VAPID Authorization JWT. Without validation this is an SSRF primitive
// (internal hosts, cloud metadata) that also leaks the signed JWT to arbitrary
// hosts. Only real push services are allowed.
const ALLOWED_PUSH_HOST_SUFFIXES = [
  "googleapis.com", // FCM (Chrome/Edge/Opera)
  "push.apple.com", // APNs (Safari)
  "mozilla.com", // Mozilla autopush
  "push.services.mozilla.com",
  "notify.windows.com", // WNS (Edge legacy)
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_PUSH_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

export async function sendWebPush(
  deviceId: string,
  subscription: WebPushSubscription,
  event: WebPushEvent,
): Promise<void> {
  if (!isAllowedPushEndpoint(subscription?.endpoint ?? "")) {
    console.warn(
      `[WebPush] Refusing to send to a non-push endpoint for device ${deviceId}`,
    );
    return;
  }
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return;
  if (!vapidConfigured) {
    webPush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
  }
  try {
    await webPush.sendNotification(
      subscription,
      JSON.stringify({
        title: event.title,
        body: event.body,
        eventId: event.id,
        // Routing data for the service worker / client deep-link.
        type: event.type,
        productId: event.productId || undefined,
        distributorId: event.distributorId,
      }),
    );
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      const { pruneDeviceToken } = await import("./push-notifications");
      await pruneDeviceToken(deviceId);
    } else {
      console.warn(`[WebPush] Failed to send to device ${deviceId}:`, error);
    }
  }
}
