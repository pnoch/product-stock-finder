import { withTimeout } from "../../../lib/with-timeout";

export const PENDING_UNREGISTER_KEY = "pending_push_unregister";

type UnregisterClient = {
  notifications: { unregisterPushToken: { mutate(): Promise<unknown> } };
};

export async function unregisterServerToken(client: UnregisterClient): Promise<boolean> {
  try {
    const result = await withTimeout(client.notifications.unregisterPushToken.mutate(), 5000);
    if (result === null) {
      console.error("[push-unregister] timed out after 5000ms");
      return false;
    }
    return true;
  } catch (e) {
    console.error("[push-unregister] unregister failed", e);
    return false;
  }
}
