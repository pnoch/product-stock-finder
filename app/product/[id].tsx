import { Stack, router } from "expo-router";
import { goBackOrHome } from "@/lib/navigation";
import { ScrollView, View, Animated } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { DetailHeader } from "@/components/product/detail-header";
import { DetailStickyHeader } from "@/components/product/detail-sticky-header";
import { DealScoreCard } from "@/components/product/deal-score-card";
import { MarketplaceCard } from "@/components/product/marketplace-card";
import { AlertSection } from "@/components/product/alert-section";
import { ReminderSection } from "@/components/product/reminder-section";
import { useProductDetailScreen } from "@/hooks/use-product-detail-screen";
import { isAcquired } from "@/lib/acquired";
import { getDistributorById } from "@shared/distributors";
import { PriceVsAvgCard } from "@/components/product/price-vs-avg-card";
import { AvailabilityCard } from "@/components/product/availability-card";
import { ProductInfoCard, DistributorListingSection, ReminderDatePickerModal, NotesCard, TargetTableCard, PriceAlertModal } from "./_components";
import { EditProductSheet } from "@/components/product/edit-product-sheet";
import { AlternativesSection } from "@/components/product/alternatives-section";
import { SkeletonCard, SkeletonChart, SkeletonDetailHeader } from "@/components/ui/skeleton";
import { EmptyStateView } from "@/components/ui/empty-state-view";

export default function ProductDetailScreen() {
  const screen = useProductDetailScreen();
  const {
    insets,
    id,
    highlightDistributorId,
    product,
    isTracked,
    listings,
    loaded,
    lastUpdatedAt,
    refresh,
    findingPrices,
    handleFindPrices,
    effectiveCurrency,
    effectiveShippingRegion,
    taxExempt,
    includeImportEstimate,
    regionFilter,
    setRegionFilter,
    regions,
    scrollY,
    stickyOpacity,
    shareRef,
    editingProduct,
    setEditingProduct,
    addingToWatchlist,
    destination,
    bestDeal,
    sortedListings,
    visibleListings,
    isSettingsLoaded,
    bestInStockListing,
    isOutOfStock,
    detailData,
    alertState,
    reminders,
    handleShare,
    handleExportCsv,
    handleToggleAcquired,
    handleAddToWatchlist,
    priceVsAvg,
    availability,
    dealScore,
    reminderTarget,
    handleSelectCountry,
    handleToggleTaxExempt,
    handleToggleImportEstimate,
  } = screen;
  const {
    insight,
    insightLoading,
    productImage,
    stockWatches,
    alerts,
    setAlerts,
    alternatives,
  } = detailData;
  const {
    alertModalVisible,
    setAlertModalVisible,
    alertDistributorId,
    setAlertDistributorId,
    alertDirection,
    setAlertDirection,
    alertPrice,
    setAlertPrice,
    alertCurrency,
    setAlertCurrency,
    alertSuggestions,
    alertDistributors,
    handleSetBestAlert,
    handleSetTarget,
    handleSetAlert,
  } = alertState;
  const {
    reminderListing,
    setReminderListing,
    reminderDate,
    setReminderDate,
    showDatePicker,
    setShowDatePicker,
    toggleAnyWatch,
    handleToggleStockWatch,
    handleSetReminder,
  } = reminders;

  if (!loaded || !isSettingsLoaded) {
    return (
      <ScreenContainer>
        <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
          <SkeletonDetailHeader />
          <View style={{ marginTop: 16 }}>
            <SkeletonCard />
            <SkeletonChart />
            <SkeletonCard />
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }
  if (!product) {
    return (
      <ScreenContainer>
        <EmptyStateView
          icon="magnifyingglass"
          title="Product not found"
          subtitle="We couldn't find this product. It may have been removed or the link is invalid."
          ctaLabel="Try Again"
          onCtaPress={() => refresh()}
          secondaryLabel="Go back"
          onSecondaryPress={() => goBackOrHome(router)}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* The screen renders its own sticky header below (with the back/share
          controls and safe-area padding). Enabling the native header too drew
          a second bar on top of it — an opaque white one in dark mode, with the
          title overlapping the status bar. Keep the root Stack's
          headerShown:false. */}
      <Stack.Screen options={{ headerShown: false }} />
      <DetailStickyHeader
        productName={product.name}
        opacity={stickyOpacity}
        topInset={insets.top}
        onEdit={() => setEditingProduct(true)}
        onShare={handleShare}
        onExportCsv={handleExportCsv}
      />
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
      >
        <DetailHeader product={product} bestDeal={bestDeal} scrollY={scrollY} watchingAny={!!stockWatches["*"]} onToggleWatch={() => void toggleAnyWatch()} acquired={isAcquired(product)} onToggleAcquired={() => void handleToggleAcquired()} isTracked={isTracked} addingToWatchlist={addingToWatchlist} onAddToWatchlist={() => void handleAddToWatchlist()} />
        <View ref={shareRef} collapsable={false}>
          {product.marketplace ? <MarketplaceCard product={product} onUpdated={refresh} /> : <ProductInfoCard product={product} listings={listings} visibleListings={visibleListings} lastUpdatedAt={lastUpdatedAt ? new Date(lastUpdatedAt).toISOString() : undefined} displayCurrency={effectiveCurrency} productImage={productImage} />}
          {!product.marketplace && <>
          {dealScore != null && <DealScoreCard dealScore={dealScore} />}
          {priceVsAvg && <PriceVsAvgCard data={priceVsAvg} displayCurrency={effectiveCurrency} />}
          {availability && <AvailabilityCard data={availability} />}
          <DistributorListingSection sortedListings={sortedListings} visibleListings={visibleListings} bestInStockListing={bestInStockListing} highlightDistributorId={highlightDistributorId} product={product} insight={insight} insightLoading={insightLoading} regionFilter={regionFilter} regions={regions} shippingRegion={effectiveShippingRegion} bestDeal={bestDeal} stockWatches={stockWatches} id={id} displayCurrency={effectiveCurrency} destination={destination} taxExempt={taxExempt} includeImportEstimate={includeImportEstimate} onSelectCountry={handleSelectCountry} onToggleTaxExempt={handleToggleTaxExempt} onToggleImportEstimate={handleToggleImportEstimate} onSetRegionFilter={setRegionFilter} onSetBestAlert={handleSetBestAlert} onToggleStockWatch={handleToggleStockWatch} onOpenChart={(listing) => router.push(`/compare/${id}?distributor=${listing.distributorId}`)} onRemind={setReminderListing} onFindPrices={handleFindPrices} findingPrices={findingPrices} onWatchAny={() => void toggleAnyWatch()} watchingAny={!!stockWatches["*"]} />
          {isOutOfStock && product?.category && (
            <AlternativesSection category={product.category} alternatives={alternatives} />
          )}
          </>}
        </View>
        {/* Notes and distributor targets sit outside the shareRef capture: notes
            are device-private and targets are personal, so neither belongs in a
            shared product image. */}
        {isTracked && <NotesCard productId={product.id} />}
        {isTracked && !product.marketplace && <>
        <TargetTableCard listings={visibleListings} alerts={alerts} productId={product.id} onSetTarget={handleSetTarget} />
        <AlertSection productId={product.id} productName={product.name} displayCurrency={effectiveCurrency} onAdded={(alert) => setAlerts((prev) => [...prev, alert])} />
        <ReminderSection productId={product.id} distributorId={reminderTarget?.distributorId} productName={product.name} distributorName={reminderTarget ? getDistributorById(reminderTarget.distributorId)?.name ?? "" : ""} onRemind={() => { if (reminderTarget) setReminderListing(reminderTarget); }} />
        </>}
      </Animated.ScrollView>
      <ReminderDatePickerModal
        visible={!!reminderListing}
        onClose={() => {
          setReminderListing(null);
          setShowDatePicker(false);
        }}
        reminderListing={reminderListing}
        reminderDate={reminderDate}
        showDatePicker={showDatePicker}
        setShowDatePicker={setShowDatePicker}
        setReminderDate={setReminderDate}
        onSetReminder={handleSetReminder}
        productName={product.name}
      />
      <EditProductSheet
        visible={editingProduct}
        onClose={() => setEditingProduct(false)}
        onSaved={() => void refresh()}
        product={product}
      />
      <PriceAlertModal
        visible={alertModalVisible}
        onClose={() => setAlertModalVisible(false)}
        onSetAlert={handleSetAlert}
        alertPrice={alertPrice}
        setAlertPrice={setAlertPrice}
        alertCurrency={alertCurrency}
        setAlertCurrency={setAlertCurrency}
        productName={product.name}
        suggestions={alertSuggestions}
        distributors={alertDistributors}
        selectedDistributorId={alertDistributorId}
        onSelectDistributor={setAlertDistributorId}
        direction={alertDirection}
        onDirectionChange={setAlertDirection}
      />
    </ScreenContainer>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
