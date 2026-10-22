import { useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  Plus,
} from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { DISTRIBUTORS } from "@shared/distributors";
import { getAllRegions } from "../../../lib/region-filter";
import type { DistributorListing } from "../../../lib/types";
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
import { useProductDetailData } from "../hooks/use-product-detail-data";
import { useProductDerived } from "../hooks/use-product-derived";
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

