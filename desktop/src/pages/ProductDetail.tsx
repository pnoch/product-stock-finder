import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router";
import {
  ArrowLeft,
  ExternalLink,
  Bell,
  Clock,
  Star,
  BarChart3,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  Share2,
  Calendar,
  Copy,
} from "lucide-react";
import { storage } from "../storage";
import { useToast } from "../hooks/use-toast";
import { getApiBaseUrl } from "../lib/api-base";
import {
  formatPrice,
  getBestPrice,
  convertPrice,
  EXCHANGE_RATES,
} from "@shared/currency";
import { formatLastRefreshed } from "../../../lib/last-refreshed";
import { computePriceVsAverage } from "../../../lib/price-average";
import { DISTRIBUTORS } from "@shared/distributors";
import {
  getAllRegions,
  filterListingsByRegion,
} from "../../../lib/region-filter";
import type { Product, PriceAlert, DistributorListing } from "../../../lib/types";
import { scopedAlertFor, productWideAlert, alertDeltaPct } from "../../../lib/alert-scope";
import { findBestDeal } from "../../../lib/best-deal";
import { computeDealScore, dealBandLabel } from "../../../lib/deal-score";
import { composeLiveListings } from "../../../lib/live-prices";
import { fetchListingsWithTimeout } from "../lib/server-prices";
import { saveNodeAsPng } from "../lib/share";
import { buildShareText } from "../../../lib/price-share";
import { getProductNote, saveProductNote } from "../../../lib/product-notes";
import { withTimeout } from "../../../lib/with-timeout";
import { StockBadge } from "../components/StockBadge";
import { Modal } from "../components/Modal";
import { DistributorHistoryModal } from "../components/DistributorHistoryModal";
import { ProductImage } from "../components/ProductImage";
import { PriceHistoryChart } from "../components/PriceHistoryChart";

function PriceSparkline({ history, currency }: { history: { price: number }[]; currency: string }) {
  if (history.length < 2) {
    return <div className="h-8 w-24 bg-gray-100 dark:bg-gray-800 rounded" />;
  }

  const prices = history.map((h) => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 96;
  const h = 32;
  const padding = 2;

  const points = prices
    .map((p, i) => {
      const x = padding + (i / (prices.length - 1)) * (w - padding * 2);
      const y = h - padding - ((p - min) / range) * (h - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const isDown = prices[prices.length - 1] < prices[0];
  const strokeColor = isDown ? "#10b981" : "#ef4444";
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const trend = lastPrice < firstPrice ? "down" : lastPrice > firstPrice ? "up" : "flat";
  const sparklineLabel = `Price sparkline, trending ${trend}, ${formatPrice(firstPrice, currency)} to ${formatPrice(lastPrice, currency)}`;

  return (
    <svg width={w} height={h} className="shrink-0" role="img" aria-label={sparklineLabel}>
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const notesStore = {
  getItem: (k: string) => Promise.resolve(localStorage.getItem(k)),
  setItem: (k: string, v: string): Promise<void> => {
    localStorage.setItem(k, v);
    return Promise.resolve();
  },
};

async function checkNotificationPermission(): Promise<boolean> {
  try {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") return true;
      if (Notification.permission === "denied") return false;
      const result = await Notification.requestPermission();
      return result === "granted";
    }
  } catch {
    // fall through to granted for Tauri
  }
  return true;
}

async function createPriceAlert(input: {
  productId: string;
  distributorId: string;
  targetPrice: number;
  currency: string;
  direction: "drop" | "rise";
}): Promise<{ ok: boolean; id: string }> {
  const granted = await checkNotificationPermission();
  if (!granted) return { ok: false, id: "" };
  const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await storage.addAlert({
    id,
    productId: input.productId,
    direction: input.direction,
    distributorId: input.distributorId,
    targetPrice: input.targetPrice,
    currency: input.currency,
    isActive: true,
    createdAt: new Date().toISOString(),
  });
  return { ok: true, id };
}

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertPrice, setAlertPrice] = useState("");
  const [alertCurrency, setAlertCurrency] = useState("USD");
  const [alertSaved, setAlertSaved] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState("USD");
  const [shippingRegion, setShippingRegion] = useState("Asia-Pacific");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const regions = useMemo(() => getAllRegions(), []);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [livePriceLoading, setLivePriceLoading] = useState(false);
  const [stockWatches, setStockWatches] = useState<Record<string, boolean>>({});
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [perListingAlertId, setPerListingAlertId] = useState<string | null>(null);
  const [perListingAlertPrice, setPerListingAlertPrice] = useState("");
  const [perListingAlertCurrency, setPerListingAlertCurrency] = useState("USD");
  const [perListingAlertDirection, setPerListingAlertDirection] = useState<"drop" | "rise">("drop");
  const [alertDirection, setAlertDirection] = useState<"drop" | "rise">("drop");
  const [alertDistributorId, setAlertDistributorId] = useState<string | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderDateInput, setReminderDateInput] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [reminderDistributorId, setReminderDistributorId] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [inlineAlertPrice, setInlineAlertPrice] = useState("");
  const [inlineAlertCurrency, setInlineAlertCurrency] = useState("USD");
  const [inlineAlertDirection, setInlineAlertDirection] = useState<"drop" | "rise">("drop");
  const [inlineAlertDistributorId, setInlineAlertDistributorId] = useState<string | null>(null);
  const [inlineReminderDate, setInlineReminderDate] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [inlineReminderDistributorId, setInlineReminderDistributorId] = useState<string | null>(null);
  const [inlineReminderError, setInlineReminderError] = useState<string | null>(null);
  const loadIdRef = useRef(0);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<DistributorListing | null>(null);

  const loadProduct = useCallback(async () => {
    if (!id) return;
    const myId = ++loadIdRef.current;
    setLoading(true);
    setLivePriceLoading(true);
    setLoadError(null);
    setRegionFilter("all");
    try {
      const [products, settings, watches, allAlerts] = await Promise.all([
        storage.getWatchlist(),
        storage.getSettings(),
        storage.getStockWatches(),
        storage.getAlerts(),
      ]);
      if (loadIdRef.current !== myId) return;
      const found = products.find((p) => p.id === id);
      if (loadIdRef.current === myId) setProduct(found ?? null);
      if (loadIdRef.current !== myId) return;
      if (loadIdRef.current === myId) {
        setDisplayCurrency(settings.displayCurrency ?? "USD");
        setShippingRegion(settings.shippingRegion ?? "Asia-Pacific");
        setPerListingAlertCurrency(settings.displayCurrency ?? "USD");
        setInlineAlertCurrency(settings.displayCurrency ?? "USD");
      }
      if (loadIdRef.current === myId) {
        const map: Record<string, boolean> = {};
        for (const w of watches) if (w.productId === id) map[w.distributorId] = true;
        setStockWatches(map);
      }
      if (loadIdRef.current === myId) {
        setAlerts(allAlerts.filter((a) => a.productId === id));
      }
      if (loadIdRef.current === myId && found && found.listings.length > 0 && getApiBaseUrl()) {
        try {
          const { createTRPCClient } = await import("../lib/trpc");
          const client = createTRPCClient();
          const seeds = found.listings;
          const results = await fetchListingsWithTimeout(client, seeds, found.modelNumber);
          if (loadIdRef.current === myId && results.some((r) => r !== null)) {
            const merged = composeLiveListings(seeds, results);
            await storage.updateProductListings(id, merged);
            if (loadIdRef.current !== myId) return;
            const refreshed = await storage.getWatchlist();
            if (loadIdRef.current !== myId) return;
            const updated = refreshed.find((p) => p.id === id);
            if (loadIdRef.current === myId && updated) {
              setProduct(updated);
              setLastRefreshedAt(Date.now());
            }
          }
        } catch {
          // live refresh is best-effort; cached listings stay visible
        }
      }
    } catch (e) {
      if (loadIdRef.current === myId) {
        setLoadError(e instanceof Error ? e.message : "Couldn't load product");
      }
    } finally {
      if (loadIdRef.current === myId) {
        setLoading(false);
        setLivePriceLoading(false);
      }
    }

    if (!("__TAURI__" in window)) {
      const base = getApiBaseUrl();
      if (base) {
        if (loadIdRef.current === myId) setInsightLoading(true);
        try {
          const { createTRPCClient } = await import("../lib/trpc");
          const client = createTRPCClient();
          const result = await withTimeout(
            client.insights.get.query({ productId: id ?? "" }),
            4000,
          );
          if (loadIdRef.current === myId) {
            if (result) setInsight(result.insight);
            setInsightLoading(false);
          }
        } catch (e) {
          console.error("[ProductDetail] insight fetch failed", e);
          if (loadIdRef.current === myId) setInsightLoading(false);
          // insight stays empty
        }
      }
      return;
    }
    const base = getApiBaseUrl();
    if (base && loadIdRef.current === myId) {
      setInsightLoading(true);
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = (await withTimeout(
          invoke("fetch_price_insight", { apiBaseUrl: base, productId: id }),
          4000,
        )) as { insight?: unknown } | null;
        if (loadIdRef.current === myId) {
          if (res && typeof res.insight === "string" && res.insight) setInsight(res.insight);
          setInsightLoading(false);
        }
      } catch (e) {
        console.error("[ProductDetail] insight fetch failed", e);
        if (loadIdRef.current === myId) setInsightLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const visibleListings =
    regionFilter === "all"
      ? (product?.listings ?? [])
      : filterListingsByRegion(product?.listings ?? [], regionFilter);

  const best = useMemo(() => {
    return getBestPrice(visibleListings, displayCurrency);
  }, [visibleListings, displayCurrency]);

  const bestListing = useMemo(() => {
    if (!best) return null;
    return visibleListings.find(
      (l) =>
        l.stockStatus !== "out_of_stock" &&
        l.price > 0 &&
        Math.abs((convertPrice(l.price, l.currency, displayCurrency) ?? l.price) - best.price) < 0.01,
    );
  }, [visibleListings, best, displayCurrency]);

  const bestDistributor = useMemo(() => {
    if (!bestListing) return null;
    return DISTRIBUTORS.find((d) => d.id === bestListing.distributorId) ?? null;
  }, [bestListing]);

  const bestDeal = useMemo(
    () => findBestDeal(visibleListings, shippingRegion, displayCurrency),
    [visibleListings, shippingRegion, displayCurrency],
  );

  const priceVsAvg = useMemo(
    () => (product ? computePriceVsAverage(product.listings ?? [], displayCurrency) : null),
    [product, displayCurrency],
  );

  const dealScore = useMemo(
    () => computeDealScore(product?.listings ?? [], displayCurrency),
    [product, displayCurrency],
  );

  const [alertError, setAlertError] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    getProductNote(product.id, notesStore)
      .then((saved) => {
        if (!cancelled) {
          setNote(saved);
          setDraftNote(saved);
          setEditingNote(false);
          setNoteError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setNoteError("Couldn't load note");
      });
    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  const handleSaveNote = async () => {
    if (!product) return;
    try {
      await saveProductNote(product.id, draftNote.trim(), notesStore);
      setNote(draftNote.trim());
      setEditingNote(false);
      setNoteError(null);
      showToast("Note saved");
    } catch {
      setNoteError("Couldn't save note");
      showToast("Couldn't save note");
    }
  };

  const handleSaveEdit = async () => {
    if (!product) return;
    setEditError(null);
    try {
      await storage.updateProductDetails(product.id, {
        name: editName.trim(),
        modelNumber: editModel.trim(),
        brand: editBrand.trim(),
        category: editCategory.trim(),
        description: editDescription.trim(),
      });
      setEditOpen(false);
      await loadProduct();
      showToast("Product updated");
    } catch {
      setEditError("Couldn't save changes");
      showToast("Couldn't save changes");
    }
  };

  const handleSaveAlert = async () => {
    if (!product || !alertPrice) return;
    const price = parseFloat(alertPrice);
    if (isNaN(price) || price <= 0) return;

    const distributorId = alertDistributorId ?? bestListing?.distributorId;
    if (!distributorId) {
      showToast("No distributor available");
      return;
    }
    const { ok } = await createPriceAlert({
      productId: product.id,
      distributorId,
      targetPrice: price,
      currency: alertCurrency,
      direction: alertDirection,
    });
    if (!ok) {
      setAlertError("Please enable notifications in your system settings to receive price alerts.");
      return;
    }
    setAlertError(null);

    setAlertSaved(true);
    setTimeout(() => {
      setAlertOpen(false);
      setAlertSaved(false);
      setAlertPrice("");
      setAlertError(null);
    }, 1200);
  };

  const handleRemindMe = () => {
    if (!product || !bestListing) {
      showToast("No distributor available");
      return;
    }
    setReminderDistributorId(bestListing.distributorId);
    setReminderDateInput(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
    setReminderError(null);
    setReminderOpen(true);
  };

  const handleSetReminder = async () => {
    if (!product) return;
    const distributorId = reminderDistributorId ?? bestListing?.distributorId;
    if (!distributorId) {
      showToast("No distributor available");
      return;
    }
    const picked = new Date(reminderDateInput + "T12:00:00");
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (isNaN(picked.getTime()) || picked.getTime() < startOfToday.getTime()) {
      setReminderError("Please select today or a future date.");
      return;
    }
    const granted = await checkNotificationPermission();
    if (!granted) {
      setReminderError("Enable notifications to set reminders.");
      return;
    }
    const dist = DISTRIBUTORS.find((d) => d.id === distributorId);
    await storage.addBackOrderReminder({
      id: `reminder-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      distributorId,
      distributorName: dist?.name ?? distributorId,
      reminderDate: picked.toISOString(),
      createdAt: new Date().toISOString(),
      reminderType: "date",
    });
    setReminderOpen(false);
    setReminderError(null);
    showToast(`Reminder set for ${picked.toLocaleDateString()}`);
  };

  const handleInlineAlert = async () => {
    if (!product) return;
    const price = parseFloat(inlineAlertPrice);
    if (isNaN(price) || price <= 0) {
      showToast("Enter a valid target price");
      return;
    }
    const distributorId = inlineAlertDistributorId ?? bestListing?.distributorId;
    if (!distributorId) {
      showToast("No distributor available");
      return;
    }
    const { ok } = await createPriceAlert({
      productId: product.id,
      distributorId,
      targetPrice: price,
      currency: inlineAlertCurrency,
      direction: inlineAlertDirection,
    });
    if (!ok) {
      showToast("Please enable notifications in your system settings to receive price alerts.");
      return;
    }
    setInlineAlertPrice("");
    showToast("Alert created");
  };

  const handleInlineReminder = async () => {
    if (!product) return;
    const distributorId = inlineReminderDistributorId ?? bestListing?.distributorId;
    if (!distributorId) {
      showToast("No distributor available");
      return;
    }
    const picked = new Date(inlineReminderDate + "T12:00:00");
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (isNaN(picked.getTime()) || picked.getTime() < startOfToday.getTime()) {
      setInlineReminderError("Please select today or a future date.");
      return;
    }
    const granted = await checkNotificationPermission();
    if (!granted) {
      setInlineReminderError("Enable notifications to set reminders.");
      return;
    }
    const dist = DISTRIBUTORS.find((d) => d.id === distributorId);
    await storage.addBackOrderReminder({
      id: `reminder-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      distributorId,
      distributorName: dist?.name ?? distributorId,
      reminderDate: picked.toISOString(),
      createdAt: new Date().toISOString(),
      reminderType: "date",
    });
    setInlineReminderError(null);
    showToast(`Reminder set for ${picked.toLocaleDateString()}`);
  };

  const handleShare = async () => {
    if (!product) return;
    const deepLink = `${window.location.origin}/#/product/${product.id}`;
    const shareText = buildShareText({
      product,
      listings: visibleListings,
      displayCurrency,
      limit: 5,
    });
    const message = `${shareText}\n\n${deepLink}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, text: message, url: deepLink });
        showToast("Shared");
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(message);
      showToast("Link copied to clipboard");
    } catch {
      showToast(deepLink);
    }
  };

  const handleCopyLink = async () => {
    if (!product) return;
    const deepLink = `${window.location.origin}/#/product/${product.id}`;
    try {
      await navigator.clipboard.writeText(deepLink);
      showToast("Link copied");
    } catch {
      showToast(deepLink);
    }
  };

  const handleSaveImage = useCallback(async () => {
    if (!summaryRef.current || !product) return;
    try {
      await saveNodeAsPng(summaryRef.current, `product-${product.id}.png`);
      showToast("Product image saved");
    } catch {
      showToast("Couldn't save product image");
    }
  }, [product]);

  const handleWatchRestock = async () => {
    if (!product || !bestListing) {
      showToast("No distributor available");
      return;
    }
    await storage.addStockWatch({
      id: `watch-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      distributorId: bestListing.distributorId,
      distributorName: bestDistributor?.name ?? "Unknown",
      reminderDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      reminderType: "back_in_stock",
      lastKnownStatus: bestListing.stockStatus,
    });
    setStockWatches((prev) => ({ ...prev, [bestListing.distributorId]: true }));
    showToast("Watching for restock");
  };

  const handleToggleListingWatch = async (listing: (typeof visibleListings)[number]) => {
    if (!product) return;
    const isWatching = !!stockWatches[listing.distributorId];
    const dist = DISTRIBUTORS.find((d) => d.id === listing.distributorId);
    if (isWatching) {
      const watches = await storage.getStockWatches();
      const target = watches.find((w) => w.productId === product.id && w.distributorId === listing.distributorId);
      if (target) await storage.removeStockWatch(target.id);
      setStockWatches((prev) => {
        const n = { ...prev };
        delete n[listing.distributorId];
        return n;
      });
      showToast("Stopped watching");
    } else {
      await storage.addStockWatch({
        id: `watch-${Date.now()}`,
        productId: product.id,
        productName: product.name,
        distributorId: listing.distributorId,
        distributorName: dist?.name ?? listing.distributorId,
        reminderDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        reminderType: "back_in_stock",
        lastKnownStatus: listing.stockStatus,
      });
      setStockWatches((prev) => ({ ...prev, [listing.distributorId]: true }));
      showToast(`Watching ${dist?.name ?? listing.distributorId} for restock`);
    }
  };

  const handlePerListingAlert = async () => {
    if (!product || !perListingAlertId) return;
    const price = parseFloat(perListingAlertPrice);
    if (isNaN(price) || price <= 0) return;
    const { ok } = await createPriceAlert({
      productId: product.id,
      distributorId: perListingAlertId,
      targetPrice: price,
      currency: perListingAlertCurrency,
      direction: perListingAlertDirection,
    });
    if (!ok) {
      showToast("Please enable notifications in your system settings to receive price alerts.");
      return;
    }
    setPerListingAlertId(null);
    setPerListingAlertPrice("");
    showToast("Alert set for distributor");
  };

  const handleQuickAlert = async () => {
    if (!product || !bestListing) return;
    const suggested = Math.round(bestListing.price * 0.95 * 100) / 100;
    const { ok } = await createPriceAlert({
      productId: product.id,
      distributorId: bestListing.distributorId,
      targetPrice: suggested,
      currency: bestListing.currency,
      direction: "drop",
    });
    if (!ok) {
      showToast("Please enable notifications in your system settings to receive price alerts.");
      return;
    }
    showToast(`Alert set at ${formatPrice(suggested, bestListing.currency)}`);
  };

  if (loading)
    return (
      <div className="p-6 space-y-6 max-w-4xl animate-fadeIn">
        <div className="h-6 w-24 rounded skeleton-shimmer" />
        <div className="flex gap-4">
          <div className="w-24 h-24 rounded-xl skeleton-shimmer shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-7 w-3/4 rounded skeleton-shimmer" />
            <div className="h-4 w-1/2 rounded skeleton-shimmer" />
            <div className="h-3 w-full rounded skeleton-shimmer" />
          </div>
        </div>
        <div className="h-32 rounded-xl skeleton-shimmer" />
        <div className="h-72 rounded-xl skeleton-shimmer" />
        <div className="h-64 rounded-xl skeleton-shimmer" />
      </div>
    );

  if (!product) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button
            onClick={() => void loadProduct()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
            aria-label={loadError ? "Retry loading product" : "Try loading product again"}
          >
            {loadError ? "Retry" : "Try Again"}
          </button>
        </div>
        {loadError ? (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200">
            Couldn't load product: {loadError}
          </div>
        ) : (
          <div className="text-center py-16">
            <h2 className="text-lg font-semibold mb-1">Product not found</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This product may have been removed from your watchlist.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {toast && (
        <div role="status" className="fixed bottom-6 right-6 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-[60] animate-fadeIn">
          {toast}
        </div>
      )}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        aria-label="Go back"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div ref={summaryRef} className="space-y-6">
      {/* Product Header */}
      <div className="flex items-start gap-4">
        <ProductImage productId={product.id} size={96} />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{product.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{product.brand}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>{product.modelNumber}</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>{product.category}</span>
          </div>
          {product.description && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {product.description}
            </p>
          )}
          {bestListing && displayCurrency !== bestListing.currency && (() => {
            const converted = convertPrice(bestListing.price, bestListing.currency, displayCurrency);
            if (converted === null) return null;
            const rate = convertPrice(1, bestListing.currency, displayCurrency);
            return (
              <>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {formatPrice(bestListing.price, bestListing.currency)} ≈ {formatPrice(converted, displayCurrency)}
                </p>
                {rate !== null ? (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    1 {bestListing.currency} = {rate.toFixed(4)} {displayCurrency}
                  </p>
                ) : null}
              </>
            );
          })()}
          {bestDistributor?.paymentMethods && bestDistributor.paymentMethods.length > 0 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              💳 {bestDistributor.paymentMethods.join(" · ")}
            </p>
          )}
        </div>
        <button
          onClick={() => {
            setEditName(product.name);
            setEditModel(product.modelNumber);
            setEditBrand(product.brand);
            setEditCategory(product.category);
            setEditDescription(product.description ?? "");
            setEditError(null);
            setEditOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0"
          aria-label="Edit product"
        >
          Edit
        </button>
      </div>

      {/* Product Note */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">My Note</h2>
          {!editingNote && (
            <button
              onClick={() => {
                setDraftNote(note);
                setNoteError(null);
                setEditingNote(true);
              }}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Edit note"
            >
              Edit
            </button>
          )}
        </div>
        {noteError && <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">{noteError}</p>}
        {editingNote ? (
          <div className="space-y-2">
            <textarea
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder="Add a note about this product…"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Product note"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDraftNote(note);
                  setNoteError(null);
                  setEditingNote(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Cancel editing note"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                aria-label="Save note"
              >
                Save
              </button>
            </div>
          </div>
        ) : note ? (
          <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{note}</p>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No note yet.</p>
        )}
      </div>

      {/* Best Distributor Card */}
      {best && bestListing && bestDistributor && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">
                Best Price
              </p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {formatPrice(best.price, best.currency)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {bestDistributor.name} · {bestDistributor.country}{" "}
                {bestDistributor.countryFlag}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StockBadge
                status={bestListing.stockStatus}
                expectedDate={bestListing.expectedDate}
              />
              <PriceSparkline history={bestListing.priceHistory} currency={bestListing.currency} />
            </div>
          </div>
          {(() => {
            const hist = bestListing.priceHistory;
            if (!hist || hist.length < 2) return null;
            const sorted = [...hist].sort((a, b) => +new Date(a.date) - +new Date(b.date));
            const oldest = sorted[0].price;
            const current = sorted[sorted.length - 1].price;
            if (current === oldest) return null;
            const pct = Math.round((Math.abs(oldest - current) / oldest) * 100);
            const down = current < oldest;
            return (
              <p
                className={`mt-1 text-sm font-medium ${down ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`}
              >
                {down ? "▼" : "▲"} {pct}%
              </p>
            );
          })()}
          {(() => {
            const hist = bestListing.priceHistory;
            if (!hist || hist.length < 2) return null;
            const priorMin =
              Math.min(
                ...hist.slice(0, -1).map((p) => convertPrice(p.price, p.currency, "USD") ?? Infinity),
              );
            const currentUsd = convertPrice(bestListing.price, bestListing.currency, "USD");
            if (currentUsd === null) return null;
            return currentUsd < priorMin ? (
              <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                Lowest Price Ever
              </p>
            ) : null;
          })()}
          {(() => {
            const suggested = Math.round(bestListing.price * 0.95 * 100) / 100;
            const label = `Set Alert at ${formatPrice(suggested, bestListing.currency)} (−5%)`;
            return (
              <button
                type="button"
                onClick={() => void handleQuickAlert()}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                aria-label={label}
              >
                <Bell className="w-3.5 h-3.5" /> {label}
              </button>
            );
          })()}
          {livePriceLoading ? (
            <button
              type="button"
              disabled
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              aria-label="Loading price"
            >
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
              </>
            </button>
          ) : bestListing.stockStatus !== "in_stock" ? (
            <a
              href={bestListing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 bg-gray-600 text-white hover:bg-gray-500 cursor-pointer"
              aria-label={`Buy ${product.name} at ${bestDistributor.name} (currently ${bestListing.stockStatus === "back_order" ? "on back order" : "out of stock"})`}
            >
              {bestListing.stockStatus === "back_order" ? (
                <>Back Order <ExternalLink className="w-3.5 h-3.5" /></>
              ) : (
                <>Out of Stock <ExternalLink className="w-3.5 h-3.5" /></>
              )}
            </a>
          ) : (
            <a
              href={bestListing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
              aria-label={`Buy ${product.name} at ${bestDistributor.name}`}
            >
              Buy Now <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}
      </div>

      {dealScore != null && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-[15px] font-bold text-gray-900 dark:text-gray-100">
            Deal Score {dealScore.score} — {dealBandLabel(dealScore.band)}
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Range {dealScore.factors.range}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Trend {dealScore.factors.trend}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Streak {dealScore.factors.streak}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Volatility {dealScore.factors.volatility}</span>
          </div>
        </div>
      )}

      {priceVsAvg && (
        <div
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4"
          aria-label={`${priceVsAvg.verdict === "below" ? "▼" : priceVsAvg.verdict === "above" ? "▲" : "—"} ${priceVsAvg.percentVsAvg > 0 ? "+" : ""}${priceVsAvg.percentVsAvg.toFixed(1)}% versus 30-day average — ${priceVsAvg.verdict === "below" ? "Below average — good time to buy" : priceVsAvg.verdict === "above" ? "Above average" : "Around its average"}`}
        >
          <span
            className={`text-2xl font-bold shrink-0 min-w-[84px] ${
              priceVsAvg.verdict === "below"
                ? "text-emerald-600 dark:text-emerald-400"
                : priceVsAvg.verdict === "above"
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {priceVsAvg.verdict === "below" ? "▼" : priceVsAvg.verdict === "above" ? "▲" : "—"}{" "}
            {priceVsAvg.percentVsAvg > 0 ? "+" : ""}
            {priceVsAvg.percentVsAvg.toFixed(1)}%
          </span>
          <div className="flex-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              vs 30-day average · avg {formatPrice(priceVsAvg.average, displayCurrency)}
            </p>
            <p className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">
              {priceVsAvg.verdict === "below"
                ? "Below average — good time to buy"
                : priceVsAvg.verdict === "above"
                  ? "Above average"
                  : "Around its average"}
            </p>
          </div>
        </div>
      )}

      {insightLoading ? (
        <div
          role="status"
          aria-label="Loading insight"
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse"
        >
          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="mt-2 h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      ) : insight ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            AI insight
          </p>
          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
            {insight}
          </p>
        </div>
      ) : null}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap transition-opacity duration-200">
        <button
          onClick={() => {
            setAlertDistributorId(bestListing?.distributorId ?? null);
            setAlertOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Set price alert"
        >
          <Bell className="w-4 h-4" /> Set Alert
        </button>
        <button
          onClick={handleRemindMe}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Set a reminder"
        >
          <Clock className="w-4 h-4" /> Remind Me
        </button>
        <button
          onClick={handleWatchRestock}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Watch for restock"
        >
          <Star className="w-4 h-4" /> Watch for Restock
        </button>
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Share product"
        >
          <Share2 className="w-4 h-4" /> Share
        </button>
        <button
          onClick={handleCopyLink}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Copy product link"
        >
          <Copy className="w-4 h-4" /> Copy Link
        </button>
        <button
          onClick={handleSaveImage}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Save product image"
        >
          <Share2 className="w-4 h-4" /> Save image
        </button>
        <Link
          to={`/compare/${product.id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Compare prices across distributors"
        >
          <BarChart3 className="w-4 h-4" /> Compare
        </Link>
        <button
          onClick={() => void loadProduct()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer disabled:opacity-50"
          aria-label="Refresh product"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
        </button>
        {lastRefreshedAt ? (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Updated {formatLastRefreshed(new Date(lastRefreshedAt).toISOString())}
          </span>
        ) : null}
      </div>

      {/* Price History Section */}
      {bestListing &&
        bestListing.priceHistory &&
        bestListing.priceHistory.length >= 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-fadeIn transition-opacity duration-200">
            <h2 className="text-lg font-semibold mb-3">Price History</h2>
            <PriceHistoryChart history={bestListing.priceHistory} displayCurrency={displayCurrency} />
          </div>
        )}

      {/* Distributor Table */}
      <div className="transition-opacity duration-200">
        <h2 className="text-lg font-semibold mb-3">
          All Listings ({visibleListings.length})
        </h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {["all", ...regions].map((region) => (
            <button
              key={region}
              onClick={() => setRegionFilter(region)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                regionFilter === region
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
              aria-label={region === "all" ? "Filter by all regions" : `Filter by ${region} region`}
            >
              {region === "all" ? "All" : region}
            </button>
          ))}
        </div>
        {bestDeal && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Best Deal (incl. shipping to {shippingRegion})
            </p>
            {(() => {
              const distrib = DISTRIBUTORS.find(
                (d) => d.id === bestDeal.distributorId,
              );
              return (
                <div className="flex items-center justify-between mt-2">
                  <p className="text-base font-bold">
                    {distrib?.countryFlag}{" "}
                    {distrib?.name ?? bestDeal.distributorId}
                  </p>
                  <p className="text-lg font-bold text-brand-600 dark:text-brand-400">
                    {formatPrice(bestDeal.total, bestDeal.currency)}
                  </p>
                </div>
              );
            })()}
            <div className="flex gap-4 mt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Price: {formatPrice(bestDeal.price, bestDeal.currency)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tax:{" "}
                {bestDeal.tax > 0
                  ? formatPrice(bestDeal.tax, bestDeal.currency)
                  : "Tax-free"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Ship: {bestDeal.shipping === null ? "N/A" : formatPrice(bestDeal.shipping, bestDeal.currency)}
              </p>
            </div>
          </div>
        )}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Distributor
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Checked
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleListings.map((listing) => {
                const dist = DISTRIBUTORS.find(
                  (d) => d.id === listing.distributorId,
                );
                const isBest =
                  bestListing &&
                  listing.distributorId === bestListing.distributorId &&
                  listing.currency === bestListing.currency;
                const isWatching = !!stockWatches[listing.distributorId];
                const convertedPrice =
                  listing.currency !== displayCurrency
                    ? convertPrice(listing.price, listing.currency, displayCurrency)
                    : null;
                const canWatch =
                  listing.stockStatus === "back_order" ||
                  listing.stockStatus === "out_of_stock";

                return (
                  <tr
                    key={`${listing.distributorId}-${listing.currency}`}
                    className={`border-b border-gray-100 dark:border-gray-700/50 last:border-0 transition-colors duration-200 ${isBest ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-l-2 border-l-emerald-400" : "hover:bg-gray-50 dark:hover:bg-gray-700/30"}`}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">
                          {dist?.name ?? listing.distributorId}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {dist?.country} {dist?.countryFlag}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold">
                        {formatPrice(listing.price, listing.currency)}
                      </span>
                      {convertedPrice !== null && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          ≈ {formatPrice(convertedPrice, displayCurrency)}
                        </p>
                      )}
                      {listing.taxRate != null && listing.taxRate > 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          +
                          {formatPrice(
                            listing.price * listing.taxRate,
                            listing.currency,
                          )}{" "}
                          tax
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Tax-free
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StockBadge
                        status={listing.stockStatus}
                        expectedDate={listing.expectedDate}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {formatLastRefreshed(listing.lastChecked)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canWatch && (
                          <button
                            onClick={() => handleToggleListingWatch(listing)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${isWatching ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                            aria-label={isWatching ? "Stop watching for restock" : "Watch for restock"}
                            title={isWatching ? "Watching — click to stop" : "Watch for restock"}
                          >
                            {isWatching ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            {isWatching ? "Watching" : "Watch"}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setPerListingAlertId(listing.distributorId);
                            setPerListingAlertPrice(String(listing.price));
                            setPerListingAlertCurrency(listing.currency);
                          }}
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          aria-label={`Set alert for ${dist?.name ?? listing.distributorId}`}
                          title="Set price alert for this distributor"
                        >
                          <Bell className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setReminderDistributorId(listing.distributorId);
                            setReminderDateInput(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
                            setReminderError(null);
                            setReminderOpen(true);
                          }}
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          aria-label={`Set reminder for ${dist?.name ?? listing.distributorId}`}
                          title="Set reminder for this distributor"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                        {listing.priceHistory && listing.priceHistory.length >= 2 ? (
                          <button
                            onClick={() => setHistoryFor(listing)}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            aria-label={`View ${dist?.name ?? listing.distributorId} price history`}
                            title="View price history"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <Link
                            to={`/compare/${product.id}?distributor=${listing.distributorId}`}
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            aria-label={`View ${dist?.name ?? listing.distributorId} price history`}
                            title="View price history"
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                          </Link>
                        )}
                        <a
                          href={listing.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 text-sm hover:underline px-1.5 py-1"
                          aria-label={`Visit ${dist?.name ?? listing.distributorId}`}
                        >
                          Visit <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleListings.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {regionFilter !== "all"
                ? `No distributors in ${regionFilter}.`
                : "No distributor listings available."}
            </div>
          )}
        </div>
      </div>

      {/* Distributor Targets */}
      {product.listings.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-lg font-semibold mb-3">Distributor Targets</h2>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {product.listings.map((listing) => {
              const dist = DISTRIBUTORS.find((d) => d.id === listing.distributorId);
              const name = dist?.name ?? listing.distributorId;
              const alert =
                scopedAlertFor(alerts, product.id, listing.distributorId, listing.currency) ??
                productWideAlert(alerts, product.id);
              const deltaPct = alert ? alertDeltaPct(listing, alert) : null;
              return (
                <li key={`${listing.distributorId}-${listing.currency}`} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {dist?.countryFlag ? `${dist.countryFlag} ` : ""}
                      {name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {formatPrice(listing.price, listing.currency)}
                      {alert && (
                        <span className="text-gray-500 dark:text-gray-400">
                          {" "}· target {formatPrice(alert.targetPrice, alert.currency)}
                        </span>
                      )}
                      {deltaPct !== null && (
                        <span
                          className={`ml-1.5 font-semibold ${deltaPct <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"}`}
                        >
                          {deltaPct > 0 ? `+${deltaPct}%` : `${deltaPct}%`}
                        </span>
                      )}
                    </p>
                  </div>
                  {!alert && (
                    <button
                      onClick={() => setPerListingAlertId(listing.distributorId)}
                      className="shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-lg font-medium leading-none"
                      aria-label={`Set target for ${name}`}
                      title={`Set target for ${name}`}
                    >
                      +
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Edit Product Modal */}
      <Modal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditError(null);
        }}
        title="Edit product"
      >
        <div className="space-y-4">
          {editError && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              {editError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Product name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Model</label>
            <input
              type="text"
              value={editModel}
              onChange={(e) => setEditModel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Product model"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Brand</label>
            <input
              type="text"
              value={editBrand}
              onChange={(e) => setEditBrand(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Product brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <input
              type="text"
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Product category"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Product description"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setEditOpen(false);
                setEditError(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Cancel editing product"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={
                !editName.trim() ||
                (editName.trim() === (product.name ?? "") &&
                  editModel.trim() === (product.modelNumber ?? "") &&
                  editBrand.trim() === (product.brand ?? "") &&
                  editCategory.trim() === (product.category ?? "") &&
                  editDescription.trim() === (product.description ?? ""))
              }
              className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
              aria-label="Save product changes"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* Set Alert Modal */}
      <Modal
        open={alertOpen}
        onClose={() => {
          setAlertOpen(false);
          setAlertSaved(false);
          setAlertPrice("");
          setAlertError(null);
        }}
        title="Set Price Alert"
      >
        {alertSaved ? (
          <div className="text-center py-4">
            <div className="text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
              Alert saved!
            </div>
            <p className="text-sm text-gray-500">
              You'll be notified when the price {alertDirection === "drop" ? "drops below" : "rises above"} your target.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Get notified when{" "}
              <span className="font-medium">{product.name}</span> {alertDirection === "drop" ? "drops below" : "rises above"}
              {" "}your target price.
            </p>
            {alertError && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                {alertError}
              </div>
            )}
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {(["drop", "rise"] as const).map((dir) => (
                <button
                  key={dir}
                  onClick={() => setAlertDirection(dir)}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${alertDirection === dir ? "bg-brand-600 text-white" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                  aria-label={dir === "drop" ? "Drops below" : "Rises above"}
                >
                  {dir === "drop" ? "▼ Drops below" : "▲ Rises above"}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Distributor</label>
              <select
                value={alertDistributorId ?? ""}
                onChange={(e) => setAlertDistributorId(e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="Alert distributor"
              >
                <option value="">Best available</option>
                {visibleListings.map((l) => {
                  const d = DISTRIBUTORS.find((x) => x.id === l.distributorId);
                  return (
                    <option key={l.distributorId} value={l.distributorId}>
                      {d?.countryFlag} {d?.name ?? l.distributorId} · {formatPrice(l.price, l.currency)}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Target Price
              </label>
              <input
                type="number"
                value={alertPrice}
                onChange={(e) => setAlertPrice(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="Target price"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <select
                value={alertCurrency}
                onChange={(e) => setAlertCurrency(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="Alert currency"
              >
                {Object.keys(EXCHANGE_RATES).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setAlertOpen(false);
                  setAlertPrice("");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAlert}
                disabled={!alertPrice || parseFloat(alertPrice) <= 0}
                className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
                aria-label="Save price alert"
              >
                Save Alert
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Per-listing Alert Modal — mirrors mobile DistributorListingCard Watch for Restock + alert flow */}
      <Modal
        open={!!perListingAlertId}
        onClose={() => {
          setPerListingAlertId(null);
          setPerListingAlertPrice("");
        }}
        title="Set Distributor Alert"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Get notified when{" "}
            <span className="font-medium">{product.name}</span> at{" "}
            <span className="font-medium">
              {DISTRIBUTORS.find((d) => d.id === perListingAlertId)?.name ?? perListingAlertId}
            </span>{" "}
            {perListingAlertDirection === "drop" ? "drops below" : "rises above"} your target.
          </p>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(["drop", "rise"] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => setPerListingAlertDirection(dir)}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${perListingAlertDirection === dir ? "bg-brand-600 text-white" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
              >
                {dir === "drop" ? "▼ Drops below" : "▲ Rises above"}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Target Price</label>
            <input
              type="number"
              value={perListingAlertPrice}
              onChange={(e) => setPerListingAlertPrice(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Distributor target price"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <select
              value={perListingAlertCurrency}
              onChange={(e) => setPerListingAlertCurrency(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Distributor alert currency"
            >
              {Object.keys(EXCHANGE_RATES).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setPerListingAlertId(null);
                setPerListingAlertPrice("");
              }}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Cancel distributor alert"
            >
              Cancel
            </button>
            <button
              onClick={handlePerListingAlert}
              disabled={!perListingAlertPrice || parseFloat(perListingAlertPrice) <= 0}
              className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
              aria-label="Save distributor alert"
            >
              Save Alert
            </button>
          </div>
        </div>
      </Modal>

      {/* Reminder Date Picker Modal */}
      <Modal
        open={reminderOpen}
        onClose={() => {
          setReminderOpen(false);
          setReminderError(null);
        }}
        title="Set Reminder"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Pick a date to be reminded to check{" "}
            <span className="font-medium">
              {DISTRIBUTORS.find((d) => d.id === reminderDistributorId)?.name ?? reminderDistributorId}
            </span>{" "}
            for {product.name}.
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Distributor</label>
            <select
              value={reminderDistributorId ?? ""}
              onChange={(e) => setReminderDistributorId(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {visibleListings.map((l) => {
                const d = DISTRIBUTORS.find((x) => x.id === l.distributorId);
                return (
                  <option key={l.distributorId} value={l.distributorId}>
                    {d?.countryFlag} {d?.name ?? l.distributorId}
                  </option>
                );
              })}
            </select>
          </div>
          <button
            onClick={() => {
              const input = document.getElementById("reminder-date-picker") as HTMLInputElement | null;
              input?.showPicker?.();
              input?.focus();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-left"
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-semibold">
                {new Date(reminderDateInput + "T12:00:00").toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </span>
            <span className="text-gray-400">▾</span>
          </button>
          <input
            id="reminder-date-picker"
            type="date"
            value={reminderDateInput}
            onChange={(e) => setReminderDateInput(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Reminder date"
          />
          {reminderError && <p className="text-xs text-amber-600 dark:text-amber-400">{reminderError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setReminderOpen(false);
                setReminderError(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSetReminder}
              className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            >
              Set Reminder
            </button>
          </div>
        </div>
      </Modal>

      {/* Per-distributor History Modal */}
      <DistributorHistoryModal
        open={historyFor !== null}
        onClose={() => setHistoryFor(null)}
        productId={product.id}
        productName={product.name}
        listing={historyFor}
        distributorName={DISTRIBUTORS.find((d) => d.id === historyFor?.distributorId)?.name ?? historyFor?.distributorId ?? ""}
        displayCurrency={displayCurrency}
      />

      {/* Inline AlertSection / ReminderSection — desktop ports of mobile components */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold mb-1">Price Alert</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Create an alert for this product.</p>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-3">
            {(["drop", "rise"] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => setInlineAlertDirection(dir)}
                className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${inlineAlertDirection === dir ? "bg-brand-600 text-white" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
              >
                {dir === "drop" ? "▼ Drops below" : "▲ Rises above"}
              </button>
            ))}
          </div>
          <div className="space-y-2 mb-3">
            <select
              value={inlineAlertDistributorId ?? ""}
              onChange={(e) => setInlineAlertDistributorId(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              aria-label="Inline alert distributor"
            >
              <option value="">Best available</option>
              {visibleListings.map((l) => {
                const d = DISTRIBUTORS.find((x) => x.id === l.distributorId);
                return (
                  <option key={l.distributorId} value={l.distributorId}>
                    {d?.countryFlag} {d?.name ?? l.distributorId}
                  </option>
                );
              })}
            </select>
            <div className="flex gap-2">
              <input
                type="number"
                value={inlineAlertPrice}
                onChange={(e) => setInlineAlertPrice(e.target.value)}
                placeholder="Target price"
                min="0"
                step="0.01"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                aria-label="Inline alert price"
              />
              <select
                value={inlineAlertCurrency}
                onChange={(e) => setInlineAlertCurrency(e.target.value)}
                className="w-24 px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                aria-label="Inline alert currency"
              >
                {Object.keys(EXCHANGE_RATES).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleInlineAlert}
            disabled={!inlineAlertPrice || parseFloat(inlineAlertPrice) <= 0}
            className="w-full px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
          >
            Add Alert
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold mb-1">Back-order Reminder</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Get reminded to check for restock.</p>
          <div className="space-y-2 mb-3">
            <select
              value={inlineReminderDistributorId ?? ""}
              onChange={(e) => setInlineReminderDistributorId(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              aria-label="Inline reminder distributor"
            >
              <option value="">Select distributor</option>
              {visibleListings.map((l) => {
                const d = DISTRIBUTORS.find((x) => x.id === l.distributorId);
                return (
                  <option key={l.distributorId} value={l.distributorId}>
                    {d?.countryFlag} {d?.name ?? l.distributorId}
                  </option>
                );
              })}
            </select>
            <input
              type="date"
              value={inlineReminderDate}
              onChange={(e) => setInlineReminderDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              aria-label="Inline reminder date"
            />
            {inlineReminderError && <p className="text-xs text-amber-600">{inlineReminderError}</p>}
          </div>
          <button
            onClick={handleInlineReminder}
            className="w-full px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
          >
            Remind Me
          </button>
        </div>
      </div>
    </div>
  );
}


