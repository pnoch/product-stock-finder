import { useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router";
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
import { useProductAlerts } from "../hooks/use-product-alerts";
import { useProductReminders } from "../hooks/use-product-reminders";
import { useProductNote } from "../hooks/use-product-note";
import { useProductEdit } from "../hooks/use-product-edit";
import { useProductSharing } from "../hooks/use-product-sharing";
import { useProductDetailData } from "../hooks/use-product-detail-data";
import { useProductDerived } from "../hooks/use-product-derived";
import { ProductDetailSkeleton, UntrackedProductCard, ProductNotFound } from "../components/product/ProductDetailStates";
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

