export function WatchlistListError({
  listError,
  onRetry,
}: {
  listError: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-800 dark:text-red-200 flex items-center gap-2"
    >
      <span className="flex-1">
        Couldn&apos;t refresh watchlist: {listError}
      </span>
      <button
        onClick={onRetry}
        className="px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-800 text-xs font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
        aria-label="Retry loading watchlist"
      >
        Retry
      </button>
    </div>
  );
}
