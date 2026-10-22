import { PackagePlus } from "lucide-react";

export function SharedWatchlistHeader({
  title,
  productsCount,
  truncated,
  metaLine,
  isAuthenticated,
  isOwner,
  isMember,
  joinPending,
  leavePending,
  adding,
  onJoin,
  onLeave,
  onExportCsv,
  onAddAll,
}: {
  title: string;
  productsCount: number;
  truncated: boolean;
  metaLine: string;
  isAuthenticated: boolean;
  isOwner: boolean;
  isMember: boolean;
  joinPending: boolean;
  leavePending: boolean;
  adding: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onExportCsv: () => void;
  onAddAll: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {productsCount} product{productsCount === 1 ? "" : "s"}
          {truncated ? " (first 500)" : ""}
          {metaLine ? ` · ${metaLine}` : ""}
        </p>
        {truncated && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            This share is larger than the 500-product limit — only the first 500 are shown.
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isAuthenticated && !isOwner && (
          isMember ? (
            <button
              onClick={onLeave}
              disabled={leavePending}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              aria-label="Leave shared watchlist"
            >
              {leavePending ? "Leaving" : "Leave"}
            </button>
          ) : (
            <button
              onClick={onJoin}
              disabled={joinPending}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-brand-600 text-brand-600 dark:text-brand-400 text-sm font-medium hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50"
              aria-label="Join shared watchlist"
            >
              {joinPending ? "Joining" : "Join"}
            </button>
          )
        )}
        <button
          onClick={onExportCsv}
          disabled={productsCount === 0}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          aria-label="Export share as CSV"
        >
          Export CSV
        </button>
        <button
          onClick={onAddAll}
          disabled={adding || productsCount === 0}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 shrink-0"
          aria-label="Add all to watchlist"
        >
          <PackagePlus className="w-4 h-4" />
          {adding ? "Adding" : "Add all to watchlist"}
        </button>
      </div>
    </div>
  );
}
