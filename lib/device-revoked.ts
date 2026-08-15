import * as Auth from "@/lib/_core/auth";
import * as Api from "@/lib/_core/api";

let revokedHandler: (() => void) | null = null;
let fired = false;

export function registerDeviceRevokedHandler(cb: () => void): () => void {
  revokedHandler = cb;
  return () => {
    revokedHandler = null;
  };
}

export async function handleDeviceRevoked(): Promise<void> {
  if (fired) return;
  fired = true;
  try {
    await Api.logout();
  } catch {
    // Best-effort: the logout endpoint clears the web session cookie.
    // Fall through and clear local state regardless.
  }
  await Auth.removeSessionToken();
  await Auth.clearUserInfo();
  revokedHandler?.();
}

export function resetDeviceRevoked(): void {
  fired = false;
}

export function resetDeviceRevokedForTests(): void {
  fired = false;
  revokedHandler = null;
}
