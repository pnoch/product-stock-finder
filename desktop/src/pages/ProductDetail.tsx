import { isTauri } from "../lib/tauri";
import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react";
import { log } from "@shared/log";
import { useParams, useNavigate, Link } from "react-router";
import {
  ArrowLeft,
  Bell,
  Clock,
  Star,
  BarChart3,
  Loader2,
  RefreshCw,
  Share2,
  Copy,
  Download,
  CheckCircle,
  Plus,
} from "lucide-react";
import { storage } from "../storage";
import { useToast } from "../hooks/use-toast";
import { getApiBaseUrl } from "../lib/api-base";
import { formatPrice } from "@shared/currency";
import { getBestPrice, convertPrice } from "@/lib/currency";
import { formatLastRefreshed, getLastRefreshedColor } from "../../../lib/last-refreshed";
import { computePriceVsAverage } from "../../../lib/price-average";
import { DISTRIBUTORS } from "@shared/distributors";
import { PRODUCT_CATALOG } from "@shared/catalog";
import {
  getAllRegions,
  filterListingsByRegion,
} from "../../../lib/region-filter";
import type { Product, PriceAlert, DistributorListing } from "../../../lib/types";
import { suggestAlertPrices } from "../../../lib/alert-suggestions";
import { findBestDeal } from "../../../lib/best-deal";
import { computeDealScore, dealBandLabel } from "../../../lib/deal-score";
import { composeLiveListings } from "../../../lib/live-prices";
import { fetchListingsWithTimeout } from "../lib/server-prices";
import { checkNotificationPermission } from "../lib/notification-permission";
import { saveNodeAsPng } from "../lib/share";
import { buildShareText } from "../../../lib/price-share";
import { productHistoryToCsv, hasExportablePriceData } from "../../../lib/csv";
import { saveCsv } from "../lib/save-csv";
import { getProductNote, saveProductNote } from "../../../lib/product-notes";
import { withTimeout } from "../../../lib/with-timeout";
import { rediscoverProduct } from "../../../lib/manual-add";
import { discoverListings } from "../../../lib/listing-discovery";
import { isAcquired } from "../../../lib/acquired";
import { DistributorHistoryModal } from "../components/DistributorHistoryModal";
import { ReminderDatePickerModal } from "../components/product/ReminderDatePickerModal";
import { SetAlertModal } from "../components/product/SetAlertModal";
import { PerListingAlertModal } from "../components/product/PerListingAlertModal";
import { InlineAlertReminderSections } from "../components/product/InlineAlertReminderSections";
import { DistributorTable } from "../components/product/DistributorTable";
import { DistributorTargets } from "../components/product/DistributorTargets";
import { EditProductModal } from "../components/product/EditProductModal";
import { ProductHeader } from "../components/product/ProductHeader";
import { ProductNoteCard } from "../components/product/ProductNoteCard";
import { BestDistributorCard } from "../components/product/BestDistributorCard";
import {
  notesStore,
  createPriceAlert,
  createStockWatchId,
} from "../lib/product-detail";
import { ProductImage } from "../components/ProductImage";
// Lazy: the chart is only needed on this screen, so it is split into its own
// chunk instead of loading on every route.

const PriceHistoryChart = lazy(() =>
  import("../components/PriceHistoryChart").then((m) => ({
    default: m.PriceHistoryChart,
  })),
);


export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTracked, setIsTracked] = useState(true);
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
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
  // Guards against a double-click / Enter+button double-submit creating two
  // alerts across any of the four alert entry points.
  const [creatingAlert, setCreatingAlert] = useState(false);
  // Same guard for reminder / restock-watch creation: each mints a fresh random
  // id, so a double-click created two reminders or two watches.
  const [savingReminder, setSavingReminder] = useState(false);
  const [perListingAlertId, setPerListingAlertId] = useState<string | null>(null);
  const [perListingAlertPrice, setPerListingAlertPrice] = useState("");
  const [perListingAlertCurrency, setPerListingAlertCurrency] = useState("USD");
  const [perListingAlertDirection, setPerListingAlertDirection] = useState<"drop" | "rise">("drop");
  const [alertDirection, setAlertDirection] = useState<"drop" | "rise">("drop");
  const [alertDistributorId, setAlertDistributorId] = useState<string | null>(null);
  // Suggested target prices (Near low / Below avg / Under current), matching
  // mobile's PriceAlertModal chips.
  const alertSuggestions = useMemo(
    () => suggestAlertPrices(product?.listings ?? [], alertCurrency),
    [product?.listings, alertCurrency],
  );
  const perListingAlertSuggestions = useMemo(
    () => suggestAlertPrices(product?.listings ?? [], perListingAlertCurrency),
    [product?.listings, perListingAlertCurrency],
  );
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
      if (loadIdRef.current === myId) {
        // Fall back to the catalog so a search result can be previewed before
        // it is added (mobile's useLiveProduct does the same).
        const catalogEntry = found ? null : PRODUCT_CATALOG.find((p) => p.id === id);
        setProduct(
          found ??
            (catalogEntry
              ? { ...catalogEntry, addedAt: "", isWatched: false, listings: [] }
              : null),
        );
        setIsTracked(!!found);
      }
      if (loadIdRef.current !== myId) return;
      if (loadIdRef.current === myId) {
        setDisplayCurrency(settings.displayCurrency ?? "USD");
        setShippingRegion(settings.shippingRegion ?? "Asia-Pacific");
        // Seed every alert-currency field from the display currency, matching
        // mobile. `alertCurrency` (the main Set Alert modal) was left at its
        // "USD" default, so a EUR/GBP user's alert was created in the wrong
        // currency.
        setAlertCurrency(settings.displayCurrency ?? "USD");
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
      if (loadIdRef.current === myId && found && (found.listings ?? []).length > 0 && getApiBaseUrl()) {
        try {
          const { createTRPCClient } = await import("../lib/trpc");
          const client = createTRPCClient();
          const seeds = found.listings ?? [];
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

    if (!isTauri()) {
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
          log.error("[ProductDetail] insight fetch failed", e);
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
        const { byoLlmHeaders } = await import("../lib/trpc");
        const res = (await withTimeout(
          invoke("fetch_price_insight", {
            apiBaseUrl: base,
            productId: id,
            // Forward the user's BYO-LLM config so the server routes this
            // insight through their provider (the browser path's tRPC client
            // sends these itself).
            llmHeaders: await byoLlmHeaders(),
          }),
          4000,
        )) as { insight?: unknown } | null;
        if (loadIdRef.current === myId) {
          if (res && typeof res.insight === "string" && res.insight) setInsight(res.insight);
          setInsightLoading(false);
        }
      } catch (e) {
        log.error("[ProductDetail] insight fetch failed", e);
        if (loadIdRef.current === myId) setInsightLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadProduct();
    });
  }, [loadProduct]);

  const visibleListings = useMemo(
    () =>
      regionFilter === "all"
        ? (product?.listings ?? [])
        : filterListingsByRegion(product?.listings ?? [], regionFilter),
    [regionFilter, product],
  );

  const best = useMemo(() => {
    return getBestPrice(visibleListings, displayCurrency);
  }, [visibleListings, displayCurrency]);

  const bestListing = useMemo(() => {
    if (!best) return null;
    return visibleListings.find((l) => {
      if (l.stockStatus === "out_of_stock" || l.price <= 0) return false;
      // Skip unconvertible listings rather than falling back to the raw price,
      // which mixed currencies and could falsely match the best price (mobile's
      // bestInStockListing skips them).
      const converted = convertPrice(l.price, l.currency, displayCurrency);
      return converted !== null && Math.abs(converted - best.price) < 0.01;
    });
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

  const headerConversion = useMemo(() => {
    if (!bestListing || displayCurrency === bestListing.currency) return null;
    const converted = convertPrice(bestListing.price, bestListing.currency, displayCurrency);
    if (converted === null) return null;
    const rate = convertPrice(1, bestListing.currency, displayCurrency);
    return { converted, rate, price: bestListing.price, currency: bestListing.currency };
  }, [bestListing, displayCurrency]);

  const trendSignal = useMemo(() => {
    const hist = bestListing?.priceHistory;
    if (!hist || hist.length < 2) return null;
    const sorted = [...hist].sort((a, b) => +new Date(a.date) - +new Date(b.date));
    const oldest = convertPrice(sorted[0].price, sorted[0].currency, displayCurrency);
    const current = convertPrice(sorted[sorted.length - 1].price, sorted[sorted.length - 1].currency, displayCurrency);
    if (oldest === null || current === null || oldest <= 0) return null;
    if (current === oldest) return null;
    const pct = Math.round((Math.abs(oldest - current) / oldest) * 100);
    const down = current < oldest;
    return { down, pct };
  }, [bestListing, displayCurrency]);

  const isLowestEver = useMemo(() => {
    const hist = bestListing?.priceHistory;
    if (!bestListing || !hist || hist.length < 2) return false;
    // Compare in the display currency, like the rest of the page: hardcoding
    // USD mixed units, so a EUR/GBP user's "lowest ever" badge was wrong.
    // Skip unconvertible points rather than mapping them to Infinity — that
    // made an all-unconvertible history claim "lowest ever" (mobile filters).
    const priorPoints = hist
      .slice(0, -1)
      .map((p) => convertPrice(p.price, p.currency, displayCurrency))
      .filter((v): v is number => v !== null);
    if (priorPoints.length === 0) return false;
    const priorMin = Math.min(...priorPoints);
    const current = convertPrice(bestListing.price, bestListing.currency, displayCurrency);
    if (current === null) return false;
    return current < priorMin;
  }, [bestListing, displayCurrency]);

  const [alertError, setAlertError] = useState<string | null>(null);
  const { toast, showToast } = useToast();
  const [findingPrices, setFindingPrices] = useState(false);
  const productId = product?.id;
  const productModelNumber = product?.modelNumber;

  const handleFindPrices = useCallback(async () => {
    if (!productModelNumber || findingPrices) return;
    setFindingPrices(true);
    try {
      const { discovered, timedOut } = await rediscoverProduct({
        storage: {
          updateProductListings: (pid: string, listings: DistributorListing[]) =>
            storage.updateProductListings(pid, listings),
        },
        discover: discoverListings,
        productId: productId ?? "",
        modelNumber: productModelNumber,
      });
      await loadProduct();
      if (discovered > 0) {
        showToast(`Found prices at ${discovered} distributor${discovered === 1 ? "" : "s"}`);
      } else if (timedOut) {
        showToast("Search timed out — try again");
      } else {
        showToast("No prices found");
      }
    } catch (e) {
      log.error("[Product] price discovery failed", e);
      showToast("Couldn't find prices");
    } finally {
      setFindingPrices(false);
    }
  }, [productId, productModelNumber, findingPrices, loadProduct, showToast]);

  const handleAddToWatchlist = useCallback(async () => {
    if (!product || addingToWatchlist) return;
    setAddingToWatchlist(true);
    try {
      await storage.addToWatchlist({
        ...product,
        addedAt: new Date().toISOString(),
        isWatched: true,
        listings: product.listings ?? [],
        tags: product.tags ?? [],
      });
      showToast("Added to watchlist");
      await loadProduct();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed");
    } finally {
      setAddingToWatchlist(false);
    }
  }, [product, addingToWatchlist, loadProduct, showToast]);

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
    // Require both name and model, like mobile's canSave: updateProductDetails
    // only applies a trimmed non-empty model, so saving a blank model silently
    // kept the old one while the UI implied it changed.
    if (!editName.trim() || !editModel.trim()) return;
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
    if (!product || !alertPrice || creatingAlert) return;
    const price = parseFloat(alertPrice);
    if (isNaN(price) || price <= 0) return;

    const distributorId = alertDistributorId ?? bestListing?.distributorId;
    if (!distributorId) {
      showToast("No distributor available");
      return;
    }
    setCreatingAlert(true);
    let result: Awaited<ReturnType<typeof createPriceAlert>>;
    try {
      result = await createPriceAlert({
        productId: product.id,
        distributorId,
        targetPrice: price,
        currency: alertCurrency,
        direction: alertDirection,
      });
    } finally {
      setCreatingAlert(false);
    }
    const { ok, alert } = result;
    if (!ok || !alert) {
      setAlertError("Please enable notifications in your system settings to receive price alerts.");
      return;
    }
    setAlerts((prev) => [...prev, alert]);
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
    if (!product || savingReminder) return;
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
    setSavingReminder(true);
    try {
      await storage.addBackOrderReminder({
        id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        productId: product.id,
        productName: product.name,
        distributorId,
        distributorName: dist?.name ?? distributorId,
        reminderDate: picked.toISOString(),
        createdAt: new Date().toISOString(),
        reminderType: "date",
      });
    } catch {
      setReminderError("Couldn't save your reminder. Please try again.");
      return;
    } finally {
      setSavingReminder(false);
    }
    setReminderOpen(false);
    setReminderError(null);
    showToast(`Reminder set for ${picked.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`);
  };

  const handleInlineAlert = async () => {
    if (!product || creatingAlert) return;
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
    setCreatingAlert(true);
    let result: Awaited<ReturnType<typeof createPriceAlert>>;
    try {
      result = await createPriceAlert({
        productId: product.id,
        distributorId,
        targetPrice: price,
        currency: inlineAlertCurrency,
        direction: inlineAlertDirection,
      });
    } finally {
      setCreatingAlert(false);
    }
    const { ok, alert } = result;
    if (!ok || !alert) {
      showToast("Please enable notifications in your system settings to receive price alerts.");
      return;
    }
    setAlerts((prev) => [...prev, alert]);
    setInlineAlertPrice("");
    showToast("Alert created");
  };

  const handleInlineReminder = async () => {
    if (!product || savingReminder) return;
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
    setSavingReminder(true);
    try {
      await storage.addBackOrderReminder({
        id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        productId: product.id,
        productName: product.name,
        distributorId,
        distributorName: dist?.name ?? distributorId,
        reminderDate: picked.toISOString(),
        createdAt: new Date().toISOString(),
        reminderType: "date",
      });
    } catch {
      setInlineReminderError("Couldn't save your reminder. Please try again.");
      return;
    } finally {
      setSavingReminder(false);
    }
    setInlineReminderError(null);
    showToast(`Reminder set for ${picked.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`);
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

  const handleExportCsv = async () => {
    if (!product) return;
    if (!hasExportablePriceData(product)) {
      showToast("Nothing to export");
      return;
    }
    const fileName = `${product.modelNumber ?? product.id}-history.csv`;
    const result = await saveCsv(fileName, productHistoryToCsv(product));
    if (result.status === "cancelled") return;
    if (result.status === "failed") {
      showToast("Couldn't export the price history");
      return;
    }
    showToast(result.path ? `Exported to ${result.path}` : "Price history exported");
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
  }, [product, showToast]);

  const handleWatchRestock = async () => {
    if (!product || !bestListing) {
      showToast("No distributor available");
      return;
    }
    if (savingReminder) return;
    // Mobile checks notification permission before creating a restock watch;
    // without it the watch is saved but no notification can ever fire.
    const granted = await checkNotificationPermission();
    if (!granted) {
      showToast("Enable notifications to watch for restocks.");
      return;
    }
    setSavingReminder(true);
    try {
      await storage.addStockWatch({
        id: `watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        productId: product.id,
        productName: product.name,
        distributorId: bestListing.distributorId,
        distributorName: bestDistributor?.name ?? "Unknown",
        reminderDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        reminderType: "back_in_stock",
        lastKnownStatus: bestListing.stockStatus,
      });
    } catch {
      showToast("Couldn't set that restock watch. Please try again.");
      return;
    } finally {
      setSavingReminder(false);
    }
    setStockWatches((prev) => ({ ...prev, [bestListing.distributorId]: true }));
    showToast("Watching for restock");
  };

  const handleToggleAcquired = async () => {
    if (!product) return;
    try {
      await storage.updateProductAcquired(
        product.id,
        isAcquired(product) ? null : new Date().toISOString(),
      );
      const refreshed = await storage.getWatchlist();
      const found = refreshed.find((p) => p.id === product.id);
      if (found) setProduct(found);
    } catch {
      showToast("Couldn't update. Please try again.");
    }
  };

  const handleToggleListingWatch = async (listing: (typeof visibleListings)[number]) => {
    if (!product || savingReminder) return;
    const isWatching = !!stockWatches[listing.distributorId];
    const dist = DISTRIBUTORS.find((d) => d.id === listing.distributorId);
    setSavingReminder(true);
    try {
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
        // Mobile checks notification permission before creating a restock watch;
        // without it the watch is saved but no notification can ever fire.
        const granted = await checkNotificationPermission();
        if (!granted) {
          showToast("Enable notifications to watch for restocks.");
          return;
        }
        await storage.addStockWatch({
          id: createStockWatchId(),
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
    } catch {
      showToast("Couldn't update that restock watch. Please try again.");
    } finally {
      setSavingReminder(false);
    }
  };

  const handlePerListingAlert = async () => {
    if (!product || !perListingAlertId || creatingAlert) return;
    const price = parseFloat(perListingAlertPrice);
    if (isNaN(price) || price <= 0) return;
    setCreatingAlert(true);
    let result: Awaited<ReturnType<typeof createPriceAlert>>;
    try {
      result = await createPriceAlert({
        productId: product.id,
        distributorId: perListingAlertId,
        targetPrice: price,
        currency: perListingAlertCurrency,
        direction: perListingAlertDirection,
      });
    } finally {
      setCreatingAlert(false);
    }
    const { ok, alert } = result;
    if (!ok || !alert) {
      showToast("Please enable notifications in your system settings to receive price alerts.");
      return;
    }
    setAlerts((prev) => [...prev, alert]);
    setPerListingAlertId(null);
    setPerListingAlertPrice("");
    showToast("Alert set for distributor");
  };

  const handleQuickAlert = async () => {
    if (!product || !bestListing || creatingAlert) return;
    const suggested = Math.round(bestListing.price * 0.95 * 100) / 100;
    setCreatingAlert(true);
    let result: Awaited<ReturnType<typeof createPriceAlert>>;
    try {
      result = await createPriceAlert({
        productId: product.id,
        distributorId: bestListing.distributorId,
        targetPrice: suggested,
        currency: bestListing.currency,
        direction: "drop",
      });
    } finally {
      setCreatingAlert(false);
    }
    const { ok, alert } = result;
    if (!ok || !alert) {
      showToast("Please enable notifications in your system settings to receive price alerts.");
      return;
    }
    setAlerts((prev) => [...prev, alert]);
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

  if (product && !isTracked) {
    return (
      <div className="p-6 space-y-6 max-w-4xl">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-start gap-4">
          <ProductImage productId={product.id} size={96} />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {product.brand} · {product.category} · {product.modelNumber}
            </p>
            {product.description && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{product.description}</p>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            This product isn&apos;t in your watchlist yet. Add it to track prices across distributors.
          </p>
          <button
            onClick={() => void handleAddToWatchlist()}
            disabled={addingToWatchlist}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            aria-label="Add to watchlist"
          >
            <Plus className="w-4 h-4" /> {addingToWatchlist ? "Adding…" : "Add to Watchlist"}
          </button>
        </div>
      </div>
    );
  }

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
            Couldn&apos;t load product: {loadError}
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
      <div ref={summaryRef} className="space-y-6">
      <ProductHeader
        product={product}
        bestDeal={bestDeal}
        bestDistributor={bestDistributor}
        headerConversion={headerConversion}
        displayCurrency={displayCurrency}
        visibleListings={visibleListings}
        best={best}
        onBack={() => navigate(-1)}
        onEdit={() => {
          setEditName(product.name);
          setEditModel(product.modelNumber);
          setEditBrand(product.brand);
          setEditCategory(product.category);
          setEditDescription(product.description ?? "");
          setEditError(null);
          setEditOpen(true);
        }}
      />

      <ProductNoteCard
        note={note}
        draftNote={draftNote}
        onDraftChange={setDraftNote}
        editingNote={editingNote}
        onStartEdit={() => {
          setDraftNote(note);
          setNoteError(null);
          setEditingNote(true);
        }}
        onCancel={() => {
          setDraftNote(note);
          setNoteError(null);
          setEditingNote(false);
        }}
        onSave={handleSaveNote}
        error={noteError}
      />

      <BestDistributorCard
        productName={product.name}
        best={best}
        bestListing={bestListing}
        bestDistributor={bestDistributor}
        trendSignal={trendSignal}
        isLowestEver={isLowestEver}
        livePriceLoading={livePriceLoading}
        onQuickAlert={() => void handleQuickAlert()}
      />
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
          onClick={() => void handleToggleAcquired()}
          className={`inline-flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer ${product && isAcquired(product) ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
          aria-label={product && isAcquired(product) ? "Acquired — tap to undo" : "Mark as acquired"}
          aria-pressed={product ? isAcquired(product) : false}
        >
          <CheckCircle className="w-4 h-4" /> {product && isAcquired(product) ? "Acquired — tap to undo" : "Mark as acquired"}
        </button>
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Share product"
        >
          <Share2 className="w-4 h-4" /> Share
        </button>
        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Export product price history as CSV"
        >
          <Download className="w-4 h-4" /> Export CSV
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
          (() => {
            // Mobile's ProductInfoCard colors the "Last refreshed" text by
            // freshness (green <1h, amber <6h, red older).
            const iso = new Date(lastRefreshedAt).toISOString();
            const key = getLastRefreshedColor(iso);
            const cls =
              key === "green"
                ? "text-emerald-600 dark:text-emerald-400"
                : key === "yellow"
                  ? "text-amber-600 dark:text-amber-400"
                  : key === "red"
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-500 dark:text-gray-400";
            return (
              <span className={`text-xs ${cls}`}>Last refreshed: {formatLastRefreshed(iso)}</span>
            );
          })()
        ) : null}
      </div>

      {/* Price History Section */}
      {bestListing &&
        bestListing.priceHistory &&
        bestListing.priceHistory.length >= 2 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-fadeIn transition-opacity duration-200">
            <h2 className="text-lg font-semibold mb-3">Price History</h2>
            <Suspense fallback={null}>
              <PriceHistoryChart history={bestListing.priceHistory} displayCurrency={displayCurrency} />
            </Suspense>
          </div>
        )}

      <DistributorTable
        productId={product.id}
        productListingsCount={(product.listings ?? []).length}
        visibleListings={visibleListings}
        regions={regions}
        regionFilter={regionFilter}
        onRegionChange={setRegionFilter}
        bestDeal={bestDeal}
        shippingRegion={shippingRegion}
        bestListing={bestListing ?? null}
        displayCurrency={displayCurrency}
        stockWatches={stockWatches}
        onToggleListingWatch={handleToggleListingWatch}
        onShowHistory={setHistoryFor}
        onSetAlert={(listing) => {
          setPerListingAlertId(listing.distributorId);
          setPerListingAlertPrice(String(listing.price));
          setPerListingAlertCurrency(listing.currency);
        }}
        onSetReminder={(listing) => {
          setReminderDistributorId(listing.distributorId);
          setReminderDateInput(
            new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          );
          setReminderError(null);
          setReminderOpen(true);
        }}
        onFindPrices={handleFindPrices}
        findingPrices={findingPrices}
      />

      <DistributorTargets
        productId={product.id}
        listings={product.listings ?? []}
        alerts={alerts}
        onSetTarget={(listing) => setPerListingAlertId(listing.distributorId)}
      />

      <EditProductModal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditError(null);
        }}
        name={editName}
        onNameChange={setEditName}
        model={editModel}
        onModelChange={setEditModel}
        brand={editBrand}
        onBrandChange={setEditBrand}
        category={editCategory}
        onCategoryChange={setEditCategory}
        description={editDescription}
        onDescriptionChange={setEditDescription}
        error={editError}
        originalName={product.name ?? ""}
        originalModel={product.modelNumber ?? ""}
        originalBrand={product.brand ?? ""}
        originalCategory={product.category ?? ""}
        originalDescription={product.description ?? ""}
        onSave={handleSaveEdit}
      />

      <SetAlertModal
        open={alertOpen}
        onClose={() => {
          setAlertOpen(false);
          setAlertSaved(false);
          setAlertPrice("");
          setAlertError(null);
        }}
        productName={product.name}
        alertSaved={alertSaved}
        alertError={alertError}
        direction={alertDirection}
        onDirectionChange={setAlertDirection}
        distributorId={alertDistributorId}
        onDistributorChange={setAlertDistributorId}
        listings={visibleListings}
        suggestions={alertSuggestions}
        price={alertPrice}
        onPriceChange={setAlertPrice}
        currency={alertCurrency}
        onCurrencyChange={setAlertCurrency}
        saving={creatingAlert}
        onSave={handleSaveAlert}
      />

      <PerListingAlertModal
        open={!!perListingAlertId}
        onClose={() => {
          setPerListingAlertId(null);
          setPerListingAlertPrice("");
        }}
        productName={product.name}
        distributorId={perListingAlertId}
        direction={perListingAlertDirection}
        onDirectionChange={setPerListingAlertDirection}
        suggestions={perListingAlertSuggestions}
        price={perListingAlertPrice}
        onPriceChange={setPerListingAlertPrice}
        currency={perListingAlertCurrency}
        onCurrencyChange={setPerListingAlertCurrency}
        saving={creatingAlert}
        onSave={handlePerListingAlert}
      />

      <ReminderDatePickerModal
        open={reminderOpen}
        onClose={() => {
          setReminderOpen(false);
          setReminderError(null);
        }}
        productName={product.name}
        listings={visibleListings}
        distributorId={reminderDistributorId}
        onDistributorChange={setReminderDistributorId}
        dateInput={reminderDateInput}
        onDateChange={setReminderDateInput}
        error={reminderError}
        saving={savingReminder}
        onSave={handleSetReminder}
      />

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

      <InlineAlertReminderSections
        listings={visibleListings}
        alertDirection={inlineAlertDirection}
        onAlertDirectionChange={setInlineAlertDirection}
        alertDistributorId={inlineAlertDistributorId}
        onAlertDistributorChange={setInlineAlertDistributorId}
        alertPrice={inlineAlertPrice}
        onAlertPriceChange={setInlineAlertPrice}
        alertCurrency={inlineAlertCurrency}
        onAlertCurrencyChange={setInlineAlertCurrency}
        onAddAlert={handleInlineAlert}
        reminderDistributorId={inlineReminderDistributorId}
        onReminderDistributorChange={setInlineReminderDistributorId}
        reminderDate={inlineReminderDate}
        onReminderDateChange={setInlineReminderDate}
        reminderError={inlineReminderError}
        onAddReminder={handleInlineReminder}
      />
    </div>
  );
}

