import { addAlert } from "@/lib/storage";
import { schedulePriceAlert } from "@/lib/notifications";
import type { PriceAlert } from "@/lib/types";

export interface CreatePriceAlertInput {
  productId: string;
  productName: string;
  targetPrice: number;
  currency: string;
  distributorId?: string;
  direction?: "drop" | "rise";
}

export interface CreatePriceAlertResult {
  saved: boolean;
  scheduled: boolean;
  alert?: PriceAlert;
  reason?: "permission" | "duplicate" | "save_failed";
}

// Deterministic id: a double-tap or a retry after a failed schedule reuses the
// same row instead of minting a second alert. `addAlert` also dedupes on
// product/target/currency/direction, so this is belt-and-braces.
function alertIdFor(input: CreatePriceAlertInput): string {
  return [
    "alert",
    input.productId,
    input.distributorId ?? "any",
    input.direction ?? "drop",
    input.targetPrice,
    input.currency,
  ].join("-");
}

/**
 * Saves the alert first, then schedules the local notification. Saving first
 * means a scheduling failure leaves a usable in-app alert instead of an orphan
 * notification; the caller can report `saved && !scheduled` and still keep the
 * alert. Permission is checked before either write so a denied prompt does not
 * create a row that can never notify.
 */
export async function createPriceAlert(
  input: CreatePriceAlertInput,
): Promise<CreatePriceAlertResult> {
  const { ensureNotificationPermission } = await import("@/lib/notifications");
  const granted = await ensureNotificationPermission();
  if (!granted) {
    return { saved: false, scheduled: false, reason: "permission" };
  }

  const alert: PriceAlert = {
    id: alertIdFor(input),
    productId: input.productId,
    distributorId: input.distributorId,
    targetPrice: input.targetPrice,
    currency: input.currency,
    direction: input.direction,
    createdAt: new Date().toISOString(),
    isActive: true,
  };

  let saved = false;
  try {
    saved = await addAlert(alert);
  } catch {
    return { saved: false, scheduled: false, reason: "save_failed" };
  }
  if (!saved) {
    return { saved: false, scheduled: false, reason: "duplicate" };
  }

  let scheduled = false;
  try {
    scheduled =
      (await schedulePriceAlert(
        input.productName,
        input.targetPrice,
        input.currency,
        input.productId,
      )) !== null;
  } catch {
    scheduled = false;
  }

  return { saved, scheduled, alert };
}
