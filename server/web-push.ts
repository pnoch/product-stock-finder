import webPush from "web-push";

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface WebPushEvent {
  id: string;
  title: string;
  body: string;
}

export async function sendWebPush(
  deviceId: string,
  subscription: WebPushSubscription,
  event: WebPushEvent,
): Promise<void> {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return;
  webPush.setVapidDetails(subject, publicKey, privateKey);
  try {
    await webPush.sendNotification(
      subscription,
      JSON.stringify({ title: event.title, body: event.body, eventId: event.id }),
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