import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Animated,
} from "react-native";
import { goBackOrHome } from "@/lib/navigation";
import { useCompareScreen } from "@/hooks/use-compare-screen";

import { ScreenContainer } from "@/components/screen-container";
import { CompareHeader } from "@/components/compare/compare-header";
import { ChartCard } from "@/components/compare/chart-card";
import { CheapestRegionCard } from "@/components/compare/cheapest-region-card";
import { CurrentPricesTable } from "@/components/compare/current-prices-table";
import { CrossAlertCTA } from "@/components/compare/cross-alert-cta";
import { DistributorSelector } from "@/components/compare/distributor-selector";
import { SkeletonChart, SkeletonList } from "@/components/ui/skeleton";
import { EmptyStateView } from "@/components/ui/empty-state-view";
import { IconSymbol } from "@/components/ui/icon-symbol";

// ─── Compare Screen ───────────────────────────────────────────────────────────
export default function CompareScreen() {
  const {
    id,
    router,
    listings,
    loaded,
    isRefreshingAny,
    refresh,
    productName,
    notFound,
    displayCurrency,
    timeRange,
    setRange,
    sortBy,
    setSortByMode,
    selected,
    toggleSelect,
    priceTrends,
    sortedListings,
    handleCrossAlert,
    handleShare,
    handleExportCsv,
    chartSeries,
    chartWidth,
    setMeasuredChartWidth,
    colors,
    insets,
    scrollY,
    stickyOpacity,
    shareRef,
  } = useCompareScreen();

  if (!id) {
    return (
      <ScreenContainer>
        <EmptyStateView
          icon="magnifyingglass"
          title="Product not found"
          subtitle="This comparison link is missing a product id."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {!loaded ? (
        <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 40 }}>
          <SkeletonChart />
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <SkeletonList count={3} />
          </View>
        </ScrollView>
      ) : notFound ? (
        <EmptyStateView
          icon="magnifyingglass"
          title="Product not found"
          subtitle="We couldn't find this product — check the link or browse your watchlist."
          ctaLabel="Try Again"
          onCtaPress={() => refresh()}
          secondaryLabel="Go back"
          onSecondaryPress={() => goBackOrHome(router)}
        />
      ) : (
        <>
          <Animated.View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              paddingHorizontal: 16,
              paddingVertical: 10,
              paddingTop: insets.top + 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              opacity: stickyOpacity,
            }}
          >
            <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 14, flex: 1 }} numberOfLines={1}>
              {productName}
            </Text>
            <View pointerEvents="auto" style={{ flexDirection: "row", alignItems: "center" }}>
              <TouchableOpacity activeOpacity={0.7} onPress={handleExportCsv} style={{ padding: 4, marginLeft: 8 }} accessibilityLabel="Export price history as CSV" accessibilityRole="button">
                <IconSymbol name="square.and.arrow.down" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} onPress={handleShare} style={{ padding: 4, marginLeft: 8 }} accessibilityLabel="Share comparison" accessibilityRole="button">
                <IconSymbol name="square.and.arrow.up" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </Animated.View>
          <Animated.ScrollView
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
          >
            {/* Header */}
            <CompareHeader
              productName={productName}
              isRefreshing={isRefreshingAny}
              onRefresh={refresh}
              onBack={() => goBackOrHome(router)}
            />

            <View
              ref={shareRef}
              collapsable={false}
              pointerEvents="box-none"
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                // The ChartCard adds 16px horizontal margin + 16px padding, so
                // usable width is w - 64 (matches the initial windowWidth - 64).
                if (w > 0) setMeasuredChartWidth(Math.max(0, w - 64));
              }}
            >
              <View pointerEvents="auto">
                <ChartCard
                  timeRange={timeRange}
                  onRangeChange={setRange}
                  chartSeries={chartSeries}
                  chartWidth={chartWidth}
                  displayCurrency={displayCurrency}
                />
              </View>
            </View>

            {/* Cheapest Region summary */}
            <CheapestRegionCard listings={listings} displayCurrency={displayCurrency} />

            <CrossAlertCTA listings={listings} displayCurrency={displayCurrency} onPress={handleCrossAlert} />

            <CurrentPricesTable listings={listings} selected={selected} displayCurrency={displayCurrency} />

            <DistributorSelector
              sortedListings={sortedListings}
              selected={selected}
              sortBy={sortBy}
              onSortChange={setSortByMode}
              onToggle={toggleSelect}
              priceTrends={priceTrends}
            />
          </Animated.ScrollView>
        </>
      )}
    </ScreenContainer>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "@/components/route-error-boundary";
