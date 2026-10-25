import AsyncStorage from "@react-native-async-storage/async-storage";

const EXPIRED_ACCOUNT_KEY = "expired_account_id";

// A session can expire while the device still holds the account's unsynced
// watchlist, alerts, and reminders. Remember which account owned that data so
// the next sign-in can keep it for the same account and wipe it for a
// different one.
export async function rememberExpiredAccount(userId: number): Promise<void> {
  try {
    await AsyncStorage.setItem(EXPIRED_ACCOUNT_KEY, String(userId));
  } catch {
    // Best-effort: without the marker the next sign-in keeps local data.
  }
}

export async function takeExpiredAccount(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(EXPIRED_ACCOUNT_KEY);
    if (raw == null) return null;
    await AsyncStorage.removeItem(EXPIRED_ACCOUNT_KEY);
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

export async function clearExpiredAccount(): Promise<void> {
  try {
    await AsyncStorage.removeItem(EXPIRED_ACCOUNT_KEY);
  } catch {
    // Best-effort.
  }
}

/**
 * Called after a successful sign-in or registration, before the shared auth
 * state publishes the user (which starts sync). Local data survives when the
 * same account returns; a different account starts from a clean slate.
 */
export async function reconcileExpiredAccount(userId: number): Promise<void> {
  const expired = await takeExpiredAccount();
  if (expired === null || expired === userId) return;
  const { clearAccountData } = await import("@/lib/storage");
  await clearAccountData();
}
