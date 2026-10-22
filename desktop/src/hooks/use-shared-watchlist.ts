import { useCallback, useEffect, useState } from "react";
import { storage } from "../storage";
import { trpc } from "../lib/trpc";
import { useAuth } from "./use-auth";
import { normalizeSharedWatchlistProduct } from "../../../lib/shared-watchlist";
import { productHistoryToCsv, watchlistToDetailedCsv } from "../../../lib/csv";
import { saveCsv } from "../lib/save-csv";
import type { Product } from "../../../lib/types";

type SharedProduct = { id: string; name: string; brand?: string; listings?: Product["listings"] };

export function useSharedWatchlist({
  token,
  showToast,
}: {
  token?: string;
  showToast: (message: string) => void;
}) {
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
  const { isAuthenticated } = useAuth();
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
    const csv = watchlistToDetailedCsv(products as never[], { shareUrl: window.location.href });
    void saveCsv(`shared-${token ?? "watchlist"}.csv`, csv).then((result) => {
      if (result.status === "cancelled") return;
      showToast(result.status === "saved" ? "Share exported as CSV" : "Couldn't export share");
    });
  }, [data, token, showToast]);

  return {
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
  };
}
