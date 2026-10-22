import { Lightbulb, Package } from "lucide-react";
import { DISTRIBUTORS } from "@shared/distributors";
import { EmptyState } from "../EmptyState";
import { OfflineBanner } from "./OfflineBanner";

export function WatchlistEmptyPage({
  queuedCount,
  isOffline,
  listError,
  onRetry,
}: {
  queuedCount: number;
  isOffline: boolean;
  listError: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="p-6 space-y-4">
      <OfflineBanner queuedCount={queuedCount} isOffline={isOffline} />
      {listError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
          <span className="flex-1">Couldn&apos;t load watchlist: {listError}</span>
          <button
            onClick={onRetry}
            className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
            aria-label="Retry loading watchlist"
          >
            Retry
          </button>
        </div>
      )}
      <EmptyState
        icon={<Package className="w-8 h-8" />}
        title="No products yet"
        description={`Add a part and we'll watch all ${DISTRIBUTORS.length} distributors — alerting you the moment it's in stock or cheaper.`}
        action={{ label: "Browse Products", to: "/search" }}
      />
      <div className="flex justify-center">
        <p className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400">
          <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
          Tip: Search for MikroTik CRS, Ubiquiti U7, RTX 4090, Pi 5, etc.
        </p>
      </div>
    </div>
  );
}
