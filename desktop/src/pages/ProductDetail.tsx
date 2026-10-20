import { isTauri } from "../lib/tauri";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { log } from "@shared/log";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  Plus,
} from "lucide-react";
import { storage } from "../storage";
import { useToast } from "../hooks/use-toast";
import { getApiBaseUrl } from "../lib/api-base";
import { getBestPrice, convertPrice } from "@/lib/currency";
import { computePriceVsAverage } from "../../../lib/price-average";
import { DISTRIBUTORS } from "@shared/distributors";
import { PRODUCT_CATALOG } from "@shared/catalog";
import {
  getAllRegions,
  filterListingsByRegion,
} from "../../../lib/region-filter";
import type { Product, PriceAlert, DistributorListing } from "../../../lib/types";
import { findBestDeal } from "../../../lib/best-deal";
import { computeDealScore } from "../../../lib/deal-score";
import { composeLiveListings } from "../../../lib/live-prices";
import { fetchListingsWithTimeout } from "../lib/server-prices";
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
import { ProductInsightCards } from "../components/product/ProductInsightCards";
import { ProductActions } from "../components/product/ProductActions";
import { PriceHistorySection } from "../components/product/PriceHistorySection";
import { ProductImage } from "../components/ProductImage";
import { useProductAlerts } from "../hooks/use-product-alerts";
import { useProductReminders } from "../hooks/use-product-reminders";
import { useProductNote } from "../hooks/use-product-note";
import { useProductEdit } from "../hooks/use-product-edit";
import { useProductSharing } from "../hooks/use-product-sharing";
// Lazy: the chart is only needed on this screen, so it is split into its own
// chunk instead of loading on every route.

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTracked, setIsTracked] = useState(true);
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
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
  // Same guard for reminder / restock-watch creation: each mints a fresh random
  // id, so a double-click created two reminders or two watches.
  const loadIdRef = useRef(0);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
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

  const { toast, showToast } = useToast();
  const {
    alertOpen,
    alertPrice,
    setAlertPrice,
    alertCurrency,
    setAlertCurrency,
    alertSaved,
    alertDirection,
    setAlertDirection,
    alertDistributorId,
    setAlertDistributorId,
    alertError,
    alertSuggestions,
    creatingAlert,
    openSetAlert,
    closeSetAlert,
    handleSaveAlert,
    perListingAlertId,
    perListingAlertPrice,
    setPerListingAlertPrice,
    perListingAlertCurrency,
    setPerListingAlertCurrency,
    perListingAlertDirection,
    setPerListingAlertDirection,
    perListingAlertSuggestions,
    openPerListingAlert,
    closePerListingAlert,
    handlePerListingAlert,
    inlineAlertPrice,
    setInlineAlertPrice,
    inlineAlertCurrency,
    setInlineAlertCurrency,
    inlineAlertDirection,
    setInlineAlertDirection,
    inlineAlertDistributorId,
    setInlineAlertDistributorId,
    handleInlineAlert,
    handleQuickAlert,
  } = useProductAlerts({
    product,
    bestListing,
    defaultCurrency: displayCurrency,
    setAlerts,
    showToast,
  });

  const {
    reminderOpen,
    reminderDateInput,
    setReminderDateInput,
    reminderDistributorId,
    setReminderDistributorId,
    reminderError,
    savingReminder,
    openReminderFor,
    closeReminder,
    handleRemindMe,
    handleSetReminder,
    inlineReminderDate,
    setInlineReminderDate,
    inlineReminderDistributorId,
    setInlineReminderDistributorId,
    inlineReminderError,
    handleInlineReminder,
    handleWatchRestock,
    handleToggleListingWatch,
  } = useProductReminders({
    product,
    bestListing,
    bestDistributor,
    stockWatches,
    setStockWatches,
    showToast,
  });

  const {
    note,
    draftNote,
    setDraftNote,
    editingNote,
    noteError,
    startEditNote,
    cancelEditNote,
    handleSaveNote,
  } = useProductNote(product, showToast);

  const {
    editOpen,
    editName,
    setEditName,
    editModel,
    setEditModel,
    editBrand,
    setEditBrand,
    editCategory,
    setEditCategory,
    editDescription,
    setEditDescription,
    editError,
    openEdit,
    closeEdit,
    handleSaveEdit,
  } = useProductEdit(product, loadProduct, showToast);

  const { handleShare, handleExportCsv, handleCopyLink, handleSaveImage } =
    useProductSharing({
      product,
      visibleListings,
      displayCurrency,
      summaryRef,
      showToast,
    });
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
        onEdit={openEdit}
      />

      <ProductNoteCard
        note={note}
        draftNote={draftNote}
        onDraftChange={setDraftNote}
        editingNote={editingNote}
        onStartEdit={startEditNote}
        onCancel={cancelEditNote}
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

      <ProductInsightCards
        dealScore={dealScore}
        priceVsAvg={priceVsAvg}
        insight={insight}
        insightLoading={insightLoading}
        displayCurrency={displayCurrency}
      />

      <ProductActions
        productId={product.id}
        isAcquired={isAcquired(product)}
        loading={loading}
        lastRefreshedAt={
          lastRefreshedAt ? new Date(lastRefreshedAt).toISOString() : null
        }
        onSetAlert={openSetAlert}
        onRemind={handleRemindMe}
        onWatchRestock={handleWatchRestock}
        onToggleAcquired={() => void handleToggleAcquired()}
        onShare={handleShare}
        onExportCsv={handleExportCsv}
        onCopyLink={handleCopyLink}
        onSaveImage={handleSaveImage}
        onRefresh={() => void loadProduct()}
      />

      <PriceHistorySection
        history={bestListing?.priceHistory ?? []}
        displayCurrency={displayCurrency}
      />

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
        onSetAlert={openPerListingAlert}
        onSetReminder={openReminderFor}
        onFindPrices={handleFindPrices}
        findingPrices={findingPrices}
      />

      <DistributorTargets
        productId={product.id}
        listings={product.listings ?? []}
        alerts={alerts}
        onSetTarget={openPerListingAlert}
      />

      <EditProductModal
        open={editOpen}
        onClose={closeEdit}
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
        onClose={closeSetAlert}
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
        onClose={closePerListingAlert}
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
        onClose={closeReminder}
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

