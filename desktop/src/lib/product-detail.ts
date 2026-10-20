import { checkNotificationPermission } from "./notification-permission";
import { storage } from "../storage";
import type { PriceAlert } from "../../../lib/types";

export const notesStore = {
  getItem: (k: string) => Promise.resolve(localStorage.getItem(k)),
  setItem: (k: string, v: string): Promise<void> => {
    localStorage.setItem(k, v);
    return Promise.resolve();
  },
};

export async function createPriceAlert(input: {
  productId: string;
  distributorId: string;
  targetPrice: number;
  currency: string;
  direction: "drop" | "rise";
}): Promise<{ ok: boolean; id: string; alert?: PriceAlert }> {
  const granted = await checkNotificationPermission();
  if (!granted) return { ok: false, id: "" };
  const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const alert: PriceAlert = {
    id,
    productId: input.productId,
    direction: input.direction,
    distributorId: input.distributorId,
    targetPrice: input.targetPrice,
    currency: input.currency,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  try {
    await storage.addAlert(alert);
  } catch {
    // A storage failure must not reject unhandled; callers show a toast on !ok.
    return { ok: false, id: "" };
  }
  // Return the alert so callers can sync the screen's `alerts` state (the
  // Distributor Targets table reads it and otherwise stays stale).
  return { ok: true, id, alert };
}

export function createStockWatchId() {
  return `watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

