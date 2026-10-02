import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Package, PackagePlus } from "lucide-react";
import { trpc } from "../lib/trpc";
import { storage } from "../storage";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../hooks/use-auth";
import { normalizeSharedWatchlistProduct } from "../../../lib/shared-watchlist";
import { productHistoryToCsv, watchlistToDetailedCsv } from "../../../lib/csv";
import { saveCsv } from "../lib/save-csv";
import type { Product } from "../../../lib/types";
import { formatPrice } from "@shared/currency";
import { getBestPrice } from "@/lib/currency";
import { getDistributorById } from "@shared/distributors";
import { StockBadge } from "../components/StockBadge";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";

interface SharedProduct {
  id: string;
  name: string;
  brand?: string;
  modelNumber?: string;
  listings?: {
    distributorId: string;
    price: number;
    currency: string;
    stockStatus: "in_stock" | "back_order" | "out_of_stock" | "unknown";
  }[];
}

export function SharedWatchlist() {
  const { token } = useParams();
  const query = trpc.sharedWatchlists.get.useQuery(
    { token: token ?? "" },
    { enabled: !!token },
  );
  const loading = query.isLoading;
  const error = !token
    ? "Share not found"
    : query.error
      ? query.error.message || "Share not found"
      : null;
  const data = query.data;
  const [adding, setAdding] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const { toast, showToast } = useToast();
  const { isAuthenticated } = useAuth();
  // Collaborative membership: previously the join/leave endpoints had no client
  // at all. `get` now reports the viewer's own membership.
  const joinMutation = trpc.sharedWatchlists.join.useMutation();
  const leaveMutation = trpc.sharedWatchlists.leave.useMutation();
  const handleJoin = useCallback(async () => {
    if (!token) return;
    try {
      await joinMutation.mutateAsync({ token });
      await query.refetch();
      showToast("Joined shared watchlist");
    } catch {
      showToast("Couldn't join that share. Please try again.");
    }
  }, [token, joinMutation, query, showToast]);
  const handleLeave = useCallback(async () => {
    if (!token) return;
    try {
      await leaveMutation.mutateAsync({ token });
      await query.refetch();
      showToast("Left shared watchlist");
    } catch {
      showToast("Couldn't leave that share. Please try again.");
    }
  }, [token, leaveMutation, query, showToast]);

  useEffect(() => {
    storage
      .getSettings()
      .then((s) => setDisplayCurrency(s.displayCurrency ?? "USD"))
      .catch(() => {});
  }, []);

  const addOne = useCallback(async (p: unknown): Promise<"added" | "duplicate" | "failed"> => {
    try {
      // addToWatchlist returns false for an already-tracked product, so a
      // second "Add all" reports duplicates instead of claiming to add them.
      return (await storage.addToWatchlist(normalizeSharedWatchlistProduct(p))) ? "added" : "duplicate";
    } catch {
      return "failed";
    }
  }, []);

  const handleAddAll = useCallback(async () => {
    const products = data?.products ?? [];
    if (products.length === 0 || adding) return;
    setAdding(true);
    let added = 0;
    let failed = 0;
    let duplicates = 0;
    for (const p of products) {
      const result = await addOne(p);
      if (result === "added") { added += 1; setAddedIds((prev) => new Set(prev).add((p as SharedProduct).id)); }
      else if (result === "duplicate") duplicates += 1;
      else failed += 1;
    }
    setAdding(false);
    const skipped = failed + duplicates;
    if (added > 0 && skipped === 0) showToast(`Added ${added} product${added === 1 ? "" : "s"}.`);
    else if (added > 0) showToast(`Added ${added}. Skipped ${skipped} (${duplicates} already tracked, ${failed} invalid).`);
    else if (duplicates > 0 && failed === 0) showToast(`All ${duplicates} product${duplicates === 1 ? " is" : "s are"} already on your watchlist.`);
    else showToast("Nothing added");
  }, [data, adding, addOne, showToast]);

  const handleExportHistory = useCallback((product: Product) => {
    void saveCsv(`${product.id}-history.csv`, productHistoryToCsv(product)).then((result) => {
      if (result.status === "cancelled") return;
      showToast(result.status === "saved" ? "History exported" : "Couldn't export history");
    });
  }, [showToast]);

  const handleExportCsv = useCallback(() => {
    const products = (data?.products ?? []) as SharedProduct[];
    // Stamp the source link so re-imports keep provenance (the CSV parser
    // skips /w/ deep-link lines on import).
    const csv = watchlistToDetailedCsv(products as never[], { shareUrl: window.location.href });
    void saveCsv(`shared-${token ?? "watchlist"}.csv`, csv).then((result) => {
      if (result.status === "cancelled") return;
      showToast(result.status === "saved" ? "Share exported as CSV" : "Couldn't export share");
    });
  }, [data, token, showToast]);

  if (loading) {
    return (
      <div className="p-6">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Share not found</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{error ?? "This share link is invalid or expired."}</p>
        <div className="flex items-center gap-3">
          {token && (
            <button
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              aria-label="Retry loading share"
            >
              {query.isFetching ? "Retrying" : "Retry"}
            </button>
          )}
          <Link to="/watchlist" className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to watchlist
          </Link>
        </div>
      </div>
    );
  }

  const products = (data.products ?? []) as SharedProduct[];
  // The server caps the public payload at 500 products; without surfacing the
  // flag the page silently looks like a complete (but short) watchlist.
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{data.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {products.length} product{products.length === 1 ? "" : "s"}
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
          {isAuthenticated && !data.isOwner && (
            data.isMember ? (
              <button
                onClick={handleLeave}
                disabled={leaveMutation.isPending}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                aria-label="Leave shared watchlist"
              >
                {leaveMutation.isPending ? "Leaving" : "Leave"}
              </button>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joinMutation.isPending}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-brand-600 text-brand-600 dark:text-brand-400 text-sm font-medium hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50"
                aria-label="Join shared watchlist"
              >
                {joinMutation.isPending ? "Joining" : "Join"}
              </button>
            )
          )}
          <button
            onClick={handleExportCsv}
            disabled={products.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            aria-label="Export share as CSV"
          >
            Export CSV
          </button>
          <button
            onClick={handleAddAll}
            disabled={adding || products.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 shrink-0"
            aria-label="Add all to watchlist"
          >
            <PackagePlus className="w-4 h-4" />
            {adding ? "Adding" : "Add all to watchlist"}
          </button>
        </div>
      </div>
      {toast && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm" role="status">
          {toast}
        </div>
      )}
      {products.length === 0 ? (
        <EmptyState icon={<Package className="w-8 h-8" />} title="No products" description="This shared watchlist is empty." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {products.map((p) => {
            const first = p.listings?.[0];
            const best = first ? getBestPrice(p.listings ?? [], displayCurrency) : null;
            const price = best ?? first;
            return (
              <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="font-semibold text-sm">{p.name}</div>
                {p.brand && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.brand}</div>}
                <div className="flex items-center gap-2 mt-2">
                  {price && (
                    <span className="text-sm font-semibold">
                      {formatPrice(price.price, price.currency)}
                    </span>
                  )}
                </div>
                {(p.listings?.length ?? 0) > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {(p.listings ?? []).slice(0, 5).map((l) => (
                      <div key={l.distributorId} className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {formatPrice(l.price, l.currency)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {getDistributorById(l.distributorId)?.name ?? l.distributorId}
                        </span>
                        <StockBadge status={l.stockStatus} />
                      </div>
                    ))}
                    {(p.listings ?? []).length > 5 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">+{(p.listings ?? []).length - 5} more distributors</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">No distributor prices yet</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={async () => {
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
                  disabled={addedIds.has(p.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  aria-label="Add to watchlist"
                >
                  {addedIds.has(p.id) ? "Added" : "Add"}
                </button>
                <button
                  onClick={() => handleExportHistory(p as unknown as Product)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  aria-label={`Export history for ${p.name}`}
                >
                  Export history
                </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
