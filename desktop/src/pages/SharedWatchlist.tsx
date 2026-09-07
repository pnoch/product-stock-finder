import { useCallback, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Package, PackagePlus } from "lucide-react";
import { trpc } from "../lib/trpc";
import { storage } from "../storage";
import { useToast } from "../hooks/use-toast";
import { normalizeSharedWatchlistProduct } from "../../../lib/shared-watchlist";
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
  listings?: Array<{
    distributorId: string;
    price: number;
    currency: string;
    stockStatus: "in_stock" | "back_order" | "out_of_stock" | "unknown";
  }>;
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
  const { toast, showToast } = useToast();

  const handleAddAll = useCallback(async () => {
    const products = data?.products ?? [];
    if (products.length === 0 || adding) return;
    setAdding(true);
    let added = 0;
    let failed = 0;
    for (const p of products) {
      try {
        await storage.addToWatchlist(normalizeSharedWatchlistProduct(p));
        added += 1;
      } catch {
        failed += 1;
      }
    }
    setAdding(false);
    if (added > 0 && failed === 0) showToast(`Added ${added} product${added === 1 ? "" : "s"}.`);
    else if (added > 0) showToast(`Added ${added}. Skipped ${failed} invalid.`);
    else showToast("Nothing added");
  }, [data, adding]);

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
        <Link to="/watchlist" className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to watchlist
        </Link>
      </div>
    );
  }

  const products = (data.products ?? []) as SharedProduct[];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{data.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {products.length} product{products.length === 1 ? "" : "s"}
            {data.expiresAt ? ` · Expires ${new Date(data.expiresAt).toLocaleDateString()}` : ""}
          </p>
        </div>
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
            const best = first ? getBestPrice(p.listings ?? [], first.currency) : null;
            const price = best ?? first;
            return (
              <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="font-semibold text-sm">{p.name}</div>
                {p.brand && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{p.brand}</div>}
                <div className="flex items-center gap-2 mt-2">
                  {first && price && (
                    <>
                      <span className="text-sm font-semibold">
                        {formatPrice(price.price, price.currency)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {getDistributorById(first.distributorId)?.name ?? first.distributorId}
                      </span>
                      <StockBadge status={first.stockStatus} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
