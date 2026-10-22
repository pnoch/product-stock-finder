import { useParams } from "react-router";
import { Package } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { useSharedWatchlist } from "../hooks/use-shared-watchlist";
import { EmptyState } from "../components/EmptyState";
import { SharedWatchlistHeader } from "../components/shared-watchlist/SharedWatchlistHeader";
import { SharedWatchlistProductCard, type SharedProduct } from "../components/shared-watchlist/SharedWatchlistProductCard";
import { SharedWatchlistLoading, SharedWatchlistError } from "../components/shared-watchlist/SharedWatchlistStates";
import type { Product } from "../../../lib/types";

export function SharedWatchlist() {
  const { token } = useParams();
  const { toast, showToast } = useToast();
  const {
    query,
    loading,
    error,
    data,
    adding,
    displayCurrency,
    addedIds,
    setAddedIds,
    isAuthenticated,
    joinMutation,
    leaveMutation,
    handleJoin,
    handleLeave,
    addOne,
    handleAddAll,
    handleExportHistory,
    handleExportCsv,
  } = useSharedWatchlist({ token, showToast });

  if (loading) return <SharedWatchlistLoading />;

  if (error || !data) {
    return (
      <SharedWatchlistError
        error={error}
        token={token}
        isFetching={query.isFetching}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const products = (data.products ?? []) as SharedProduct[];
  const truncated = (data as { truncated?: boolean }).truncated === true;
  const createdLabel = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : null;
  const lastSharedLabel = (data as { updatedAt?: string | null }).updatedAt
    ? new Date((data as { updatedAt?: string | null }).updatedAt as string).toLocaleDateString()
    : null;
  const expiresLabel = data.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : null;
  const metaLine = [
    createdLabel ? `Shared ${createdLabel}` : null,
    lastSharedLabel ? `Last shared ${lastSharedLabel}` : null,
    expiresLabel ? `Expires ${expiresLabel}` : null,
  ].filter((x): x is string => x !== null).join(" · ");

  return (
    <div className="p-6 space-y-4">
      <SharedWatchlistHeader
        title={data.title}
        productsCount={products.length}
        truncated={truncated}
        metaLine={metaLine}
        isAuthenticated={isAuthenticated}
        isOwner={data.isOwner}
        isMember={data.isMember}
        joinPending={joinMutation.isPending}
        leavePending={leaveMutation.isPending}
        adding={adding}
        onJoin={() => void handleJoin()}
        onLeave={() => void handleLeave()}
        onExportCsv={handleExportCsv}
        onAddAll={() => void handleAddAll()}
      />
      {toast && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm" role="status">
          {toast}
        </div>
      )}
      {products.length === 0 ? (
        <EmptyState icon={<Package className="w-8 h-8" />} title="No products" description="This shared watchlist is empty." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {products.map((p) => (
            <SharedWatchlistProductCard
              key={p.id}
              product={p}
              displayCurrency={displayCurrency}
              added={addedIds.has(p.id)}
              onAdd={async () => {
                const result = await addOne(p);
                if (result === "added") {
                  setAddedIds((prev) => new Set(prev).add(p.id));
                  showToast(`Added ${p.name}.`);
                } else if (result === "duplicate") {
                  setAddedIds((prev) => new Set(prev).add(p.id));
                  showToast(`${p.name} is already on your watchlist.`);
                } else {
                  showToast(`Couldn't add ${p.name}.`);
                }
              }}
              onExportHistory={() => handleExportHistory(p as unknown as Product)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
