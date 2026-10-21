import {
  getAlerts,
  getPriceDigestSnapshot,
  getWatchlist,
  savePriceDigestSnapshot,
} from "../storage";
import { maybeSendDigest } from "../price-digest";
import { activeProducts } from "../acquired";
import { isAutomaticProduct } from "../marketplace";
import type { AppSettings } from "../types";

/** Sends the scheduled digest if one is due. */
export async function sendScheduledDigest(
  settings: AppSettings,
): Promise<void> {
  const prevDigest = await getPriceDigestSnapshot();
  const nextDigest = await maybeSendDigest(
    prevDigest,
    activeProducts(await getWatchlist()).filter(isAutomaticProduct),
    settings,
    await getAlerts(),
  );
  if (nextDigest) await savePriceDigestSnapshot(nextDigest);
}
