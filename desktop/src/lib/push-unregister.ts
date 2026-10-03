import { withTimeout } from "../../../lib/with-timeout";
import { log } from "@shared/log";

export const PENDING_UNREGISTER_KEY = "pending_push_unregister";

type UnregisterClient = {
  notifications: { unregisterPushToken: { mutate(): Promise<unknown> } };
};

export async function unregisterServerToken(client: UnregisterClient): Promise<boolean> {
  try {
    const result = await withTimeout(client.notifications.unregisterPushToken.mutate(), 5000);
    if (result === null) {
      log.error("[push-unregister] timed out after 5000ms");
      return false;
    }
    return true;
  } catch (e) {
    log.error("[push-unregister] unregister failed", e);
    return false;
  }
}
