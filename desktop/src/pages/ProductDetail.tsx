import { useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { useToast } from "../hooks/use-toast";
import { getAllRegions } from "../../../lib/region-filter";
import type { DistributorListing } from "../../../lib/types";
import { isAcquired } from "../../../lib/acquired";
import { DistributorTable } from "../components/product/DistributorTable";
import { DistributorTargets } from "../components/product/DistributorTargets";
import { ProductHeader } from "../components/product/ProductHeader";
import { ProductNoteCard } from "../components/product/ProductNoteCard";
import { BestDistributorCard } from "../components/product/BestDistributorCard";
import { ProductInsightCards } from "../components/product/ProductInsightCards";
import { ProductActions } from "../components/product/ProductActions";
import { PriceHistorySection } from "../components/product/PriceHistorySection";
import { useProductAlerts } from "../hooks/use-product-alerts";
import { useProductReminders } from "../hooks/use-product-reminders";
import { useProductNote } from "../hooks/use-product-note";
import { useProductEdit } from "../hooks/use-product-edit";
import { useProductSharing } from "../hooks/use-product-sharing";
import { useProductDetailData } from "../hooks/use-product-detail-data";
import { useProductDerived } from "../hooks/use-product-derived";
import { ProductDetailSkeleton, UntrackedProductCard, ProductNotFound } from "../components/product/ProductDetailStates";
import { ProductDetailModals } from "../components/product/ProductDetailModals";
// Lazy: the chart is only needed on this screen, so it is split into its own
// chunk instead of loading on every route.

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast, showToast } = useToast();
  const {
    product,
    loading,
    isTracked,
    addingToWatchlist,
    displayCurrency,
    shippingRegion,
    regionFilter,
    setRegionFilter,
    insight,
    insightLoading,
    loadError,
    livePriceLoading,
    stockWatches,
    setStockWatches,
    alerts,
    setAlerts,
    lastRefreshedAt,
    findingPrices,
    loadProduct,
    handleFindPrices,
    handleAddToWatchlist,
    handleToggleAcquired,
  } = useProductDetailData({ id, showToast });
  const regions = useMemo(() => getAllRegions(), []);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [historyFor, setHistoryFor] = useState<DistributorListing | null>(null);

  const {
    visibleListings,
    best,
    bestListing,
    bestDistributor,
    bestDeal,
    priceVsAvg,
    dealScore,
    headerConversion,
    trendSignal,
    isLowestEver,
  } = useProductDerived({
    product,
    regionFilter,
    displayCurrency,
    shippingRegion,
  });

  const alertState = useProductAlerts({
    product,
    bestListing,
    defaultCurrency: displayCurrency,
    setAlerts,
    showToast,
  });
  const { openSetAlert, handleQuickAlert, openPerListingAlert } = alertState;


  const reminderState = useProductReminders({
    product,
    bestListing,
    bestDistributor,
    stockWatches,
    setStockWatches,
    showToast,
  });
  const {
    handleRemindMe,
    handleWatchRestock,
    openReminderFor,
    handleToggleListingWatch,
  } = reminderState;


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

  const editState = useProductEdit(product, loadProduct, showToast);
  const { openEdit } = editState;


  const { handleShare, handleExportCsv, handleCopyLink, handleSaveImage } =
    useProductSharing({
      product,
      visibleListings,
      displayCurrency,
      summaryRef,
      showToast,
    });
  if (loading) return <ProductDetailSkeleton />;

  if (product && !isTracked) {
    return (
      <UntrackedProductCard
        product={product}
        addingToWatchlist={addingToWatchlist}
        onAdd={() => void handleAddToWatchlist()}
        onBack={() => navigate(-1)}
      />
    );
  }

  if (!product) {
    return (
      <ProductNotFound
        loadError={loadError}
        onBack={() => navigate(-1)}
        onRetry={() => void loadProduct()}
      />
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

      <ProductDetailModals
        product={product}
        visibleListings={visibleListings}
        historyFor={historyFor}
        setHistoryFor={setHistoryFor}
        displayCurrency={displayCurrency}
        edit={editState}
        alert={alertState}
        reminder={reminderState}
      />
    </div>
  );
}

