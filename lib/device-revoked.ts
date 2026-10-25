import * as Auth from "@/lib/_core/auth";
import * as Api from "@/lib/_core/api";
import { rememberExpiredAccount } from "@/lib/expired-account";

let revokedHandler: (() => void) | null = null;
let fired = false;

export function registerDeviceRevokedHandler(cb: () => void): () => void {
  fired = false;
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
  // Keep the account id so a later sign-in can tell whether the local data
  // belongs to the returning account or must be wiped for a different one.
  const user = await Auth.getUserInfo();
  if (user?.id != null) await rememberExpiredAccount(user.id);
  await Auth.removeSessionToken();
  await Auth.clearUserInfo();
  revokedHandler?.();
  // Allow future revocations after the current logout cycle completes
  // (e.g., user re-authenticates and is revoked again). Reset on next tick
  // so concurrent duplicate invocations are still coalesced.
  setTimeout(() => {
    fired = false;
  }, 0);
}

export function resetDeviceRevoked(): void {
  fired = false;
}

export function resetDeviceRevokedForTests(): void {
  fired = false;
  revokedHandler = null;
}
