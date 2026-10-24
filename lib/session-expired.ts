import * as Auth from "@/lib/_core/auth";

let expiredHandler: (() => void) | null = null;
let fired = false;

export function registerSessionExpiredHandler(cb: () => void): () => void {
  // Do not reset `fired` here: the effect can re-register while concurrent
  // requests are still failing, which would show the dialog again.
  expiredHandler = cb;
  return () => {
    expiredHandler = null;
  };
}

// A server-side UNAUTHORIZED means the stored token is no longer valid (for
// example the signing secret rotated). Clear it so the UI stops claiming the
// user is signed in while every authenticated call fails. Local data is kept:
// it may contain unsynced changes and belongs to the account being signed out.
export async function handleSessionExpired(): Promise<void> {
  if (fired) return;
  fired = true;
  // Signed-out requests also return UNAUTHORIZED. Only a stored session can
  // expire, so skip the dialog when there is nothing to clear.
  const [token, user] = await Promise.all([
    Auth.getSessionToken(),
    Auth.getUserInfo(),
  ]);
  if (!token && !user) {
    fired = false;
    return;
  }
  await Auth.removeSessionToken();
  await Auth.clearUserInfo();
  expiredHandler?.();
  setTimeout(() => {
    fired = false;
  }, 0);
}

export function resetSessionExpiredForTests(): void {
  fired = false;
  expiredHandler = null;
}
