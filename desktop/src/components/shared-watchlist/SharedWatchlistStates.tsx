import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { LoadingSpinner } from "../LoadingSpinner";

export function SharedWatchlistLoading() {
  return (
    <div className="p-6">
      <LoadingSpinner />
    </div>
  );
}

export function SharedWatchlistError({
  error,
  token,
  isFetching,
  onRetry,
}: {
  error: string | null;
  token?: string;
  isFetching: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Share not found</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">{error ?? "This share link is invalid or expired."}</p>
      <div className="flex items-center gap-3">
        {token && (
          <button
            onClick={onRetry}
            disabled={isFetching}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            aria-label="Retry loading share"
          >
            {isFetching ? "Retrying" : "Retry"}
          </button>
        )}
        <Link to="/watchlist" className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to watchlist
        </Link>
      </div>
    </div>
  );
}
