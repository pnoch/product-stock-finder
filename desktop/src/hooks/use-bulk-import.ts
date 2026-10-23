import { useMemo, useState } from "react";
import { storage } from "../storage";
import { matchModels, parseModelInput } from "../../../lib/bulk-import";
import { runDiscoveryLoop } from "../../../lib/bulk-discovery";
import { discoverListings } from "../../../lib/listing-discovery";
import type { DistributorListing } from "../../../lib/types";
import { confirmAction } from "../lib/confirm";

export function useBulkImport({
  trackedIds,
  setTrackedIds,
  showToast,
}: {
  trackedIds: Set<string>;
  setTrackedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  showToast: (message: string) => void;
}) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);

  const bulkPreview = useMemo(() => matchModels(parseModelInput(bulkText)), [bulkText]);
  const bulkNew = useMemo(() => bulkPreview.matched.filter((p) => !trackedIds.has(p.id)), [bulkPreview, trackedIds]);

  const handleBulkImport = async () => {
    if (bulkImporting || bulkNew.length === 0) return;
    setBulkImporting(true);
    try {
      const results = await Promise.allSettled(
        bulkNew.map((it) => storage.addToWatchlist({ ...it, addedAt: new Date().toISOString(), isWatched: true, listings: [], tags: [] })),
      );
      const added = bulkNew.filter(
        (_, i) =>
          results[i]!.status === "fulfilled" &&
          (results[i] as PromiseFulfilledResult<boolean>).value === true,
      );
      setTrackedIds((prev) => new Set([...prev, ...added.map((p) => p.id)]));
      setBulkText(""); setBulkOpen(false);
      const failed = bulkNew.length - added.length;
      setBulkImporting(false);
      let discovered = 0;
      if (added.length > 0) {
        const items = added.map((p) => ({ productId: p.id, modelNumber: p.modelNumber }));
        const rediscoverStorage = {
          updateProductListings: (pid: string, listings: DistributorListing[]) =>
            storage.updateProductListings(pid, listings),
        };
        const loop = await runDiscoveryLoop({
          items,
          storage: rediscoverStorage,
          discover: discoverListings,
          confirmContinue: (remaining) =>
            confirmAction({
              title: "Continue discovery?",
              message: `Fetch prices for the remaining ${remaining} product${remaining === 1 ? "" : "s"}?`,
              confirmLabel: "Continue",
            }),
        });
        discovered = loop.discovered;
      }
      const discoveryNote = discovered > 0 ? ` · ${discovered} listing${discovered === 1 ? "" : "s"} found` : "";
      showToast(
        failed > 0
          ? `Imported ${added.length} · ${failed} failed${discoveryNote}`
          : `Imported ${added.length}${discoveryNote}`,
      );
    } finally { setBulkImporting(false); }
  };

  return {
    bulkOpen,
    setBulkOpen,
    bulkText,
    setBulkText,
    bulkImporting,
    bulkPreview,
    bulkNew,
    handleBulkImport,
  };
}
