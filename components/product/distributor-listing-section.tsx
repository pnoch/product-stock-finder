import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import { selectBestListing } from "@/lib/currency";
import { BestDistributorCard } from "@/components/best-distributor-card";
import type { Product } from "@/lib/types";
import type { BestDeal } from "@/lib/best-deal";
import type { Destination } from "@/lib/landed-cost";
import { CountryPicker } from "@/components/ui/country-picker";
import { SkeletonBox } from "@/components/ui/skeleton";
import { getCountry } from "@shared/countries";
import { DistributorListingCard } from "./distributor-listing-card";
import { DistributorListingEmpty } from "./distributor-listing-empty";
import { ShippingOptionsCard } from "./shipping-options-card";
import { BestDealEstimateCard } from "./best-deal-estimate-card";
import { RegionFilterRow } from "./region-filter-row";
import { AiInsightCard } from "./ai-insight-card";

interface DistributorListingSectionProps {
  sortedListings: DistributorListing[];
  visibleListings: DistributorListing[];
  bestInStockListing: DistributorListing | null;
  product: Product;
  insight: string | null;
  insightLoading?: boolean;
  regionFilter: string;
  regions: string[];
  shippingRegion: string;
  bestDeal: BestDeal | null;
  stockWatches: Record<string, boolean>;
  id: string;
  displayCurrency: string;
  destination: Destination | null;
  highlightDistributorId?: string;
  taxExempt: boolean;
  includeImportEstimate: boolean;
  onSelectCountry: (code: string) => void;
  onToggleTaxExempt: (value: boolean) => void;
  onToggleImportEstimate: (value: boolean) => void;
  onSetRegionFilter: (region: string) => void;
  onSetBestAlert: (listing: DistributorListing, targetPrice: number) => void;
  onToggleStockWatch: (listing: DistributorListing) => void;
  onOpenChart: (listing: DistributorListing) => void;
  onRemind?: (listing: DistributorListing) => void;
  onFindPrices?: () => void;
  findingPrices?: boolean;
  findingProgress?: { done: number; total: number } | null;
  hasIncompleteDiscovery?: boolean;
  onWatchAny?: () => void;
  watchingAny?: boolean;
}

function InsightSkeleton() {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginTop: 12,
      }}
    >
      <SkeletonBox width={72} height={10} borderRadius={6} />
      <SkeletonBox width="94%" height={12} borderRadius={6} style={{ marginTop: 10 }} />
      <SkeletonBox width="78%" height={12} borderRadius={6} style={{ marginTop: 8 }} />
      <SkeletonBox width="62%" height={12} borderRadius={6} style={{ marginTop: 8 }} />
    </View>
  );
}

function BestDealSkeleton() {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <SkeletonBox width={140} height={10} borderRadius={6} />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 12,
        }}
      >
        <SkeletonBox width={120} height={16} borderRadius={6} />
        <SkeletonBox width={80} height={20} borderRadius={10} />
      </View>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
        <SkeletonBox width="30%" height={10} borderRadius={6} />
        <SkeletonBox width="30%" height={10} borderRadius={6} />
        <SkeletonBox width="30%" height={10} borderRadius={6} />
      </View>
    </View>
  );
}

export function DistributorListingSection({
  sortedListings,
  visibleListings,
  bestInStockListing,
  product,
  insight,
  insightLoading,
  regionFilter,
  regions,
  shippingRegion,
  bestDeal,
  stockWatches,
  id,
  displayCurrency,
  destination,
  highlightDistributorId,
  taxExempt,
  includeImportEstimate,
  onSelectCountry,
  onToggleTaxExempt,
  onToggleImportEstimate,
  onSetRegionFilter,
  onSetBestAlert,
  onToggleStockWatch,
  onOpenChart,
  onRemind,
  onFindPrices,
  findingPrices,
  findingProgress,
  hasIncompleteDiscovery,
  onWatchAny,
  watchingAny,
}: DistributorListingSectionProps) {
  const colors = useColors();
  const [pickerVisible, setPickerVisible] = useState(false);
  const selectedCountry = destination ? getCountry(destination.countryCode) : undefined;
  // The Best Price card must never crown an `unknown`/`out_of_stock` listing
  // (lib/currency.ts also excludes those). Prefer the region-filtered listing the
  // screen already computed; otherwise take the cheapest in-stock/back-order
  // listing, and render no card at all when nothing is orderable.
  const globalBestInStockListing = bestInStockListing ?? (() => {
    const orderable = sortedListings.filter(
      (l) => l.stockStatus === "in_stock" || l.stockStatus === "back_order",
    );
    if (orderable.length === 0) return null;
    return (
      selectBestListing(orderable, {
        currency: displayCurrency ?? "USD",
        stock: "any",
      })?.listing ?? null
    );
  })();

  return (
    <View style={{ paddingHorizontal: 16 }}>
      <Text
        style={{
          color: colors.foreground,
          fontWeight: "700",
          fontSize: 15,
          marginBottom: 12,
        }}
      >
        Distributor Prices
      </Text>
      {findingPrices && (
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
          {findingProgress
            ? `Checking distributors… ${findingProgress.done}/${findingProgress.total}`
            : "Checking distributors…"}
        </Text>
      )}
      {sortedListings.length === 0 || visibleListings.length === 0 ? (
        <DistributorListingEmpty
          colors={colors}
          hasListings={sortedListings.length > 0}
          regionFilter={regionFilter}
          findingPrices={findingPrices ?? false}
          findingProgress={findingProgress}
          watchingAny={watchingAny ?? false}
          onFindPrices={onFindPrices}
          onWatchAny={onWatchAny}
          onShowAll={() => onSetRegionFilter("all")}
        />
      ) : (
        <>
          {globalBestInStockListing && (
            <BestDistributorCard
              listing={globalBestInStockListing}
              product={product}
              onSetAlert={(targetPrice) =>
                onSetBestAlert(globalBestInStockListing, targetPrice)
              }
              displayCurrency={displayCurrency}
            />
          )}
          {insightLoading ? (
            <InsightSkeleton />
          ) : insight ? (
            <AiInsightCard colors={colors} insight={insight} />
          ) : null}
          <ShippingOptionsCard
            colors={colors}
            destination={destination}
            taxExempt={taxExempt ?? false}
            onToggleTaxExempt={onToggleTaxExempt}
            includeImportEstimate={includeImportEstimate ?? false}
            onToggleImportEstimate={onToggleImportEstimate}
            onOpenPicker={() => setPickerVisible(true)}
          />
          {visibleListings.length > 0 && (
            <Text
              style={{
                color: colors.muted,
                fontSize: 12,
                fontWeight: "600",
                marginBottom: 10,
                marginTop: 4,
                letterSpacing: 0.5,
              }}
            >
              ALL DISTRIBUTORS
            </Text>
          )}
          <RegionFilterRow
            colors={colors}
            regions={regions}
            regionFilter={regionFilter}
            onSetRegionFilter={onSetRegionFilter}
          />
          {!bestDeal && insightLoading && sortedListings.length > 0 ? (
            <BestDealSkeleton />
          ) : null}
          {bestDeal && (
            <BestDealEstimateCard
              colors={colors}
              bestDeal={bestDeal}
              destination={destination}
              selectedCountry={selectedCountry}
              shippingRegion={shippingRegion}
              sortedListings={sortedListings}
            />
          )}
          {visibleListings.map((listing) => (
            <DistributorListingCard
              key={listing.distributorId}
              listing={listing}
              displayCurrency={displayCurrency}
              stockWatches={stockWatches}
              highlighted={listing.distributorId === highlightDistributorId}
              onToggleStockWatch={onToggleStockWatch}
              onOpenChart={onOpenChart}
              onRemind={onRemind}
              hasDestination={destination != null}
            />
          ))}
          {hasIncompleteDiscovery && onFindPrices && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onFindPrices}
              disabled={findingPrices}
              style={{
                alignSelf: "center",
                marginTop: 4,
                marginBottom: 12,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.primary,
                opacity: findingPrices ? 0.6 : 1,
              }}
              accessibilityLabel="Find more prices"
              accessibilityRole="button"
            >
              <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
                {findingPrices ? "Finding more…" : "Find more prices"}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
      <CountryPicker
        visible={pickerVisible}
        value={destination?.countryCode}
        onSelect={(code) => {
          onSelectCountry(code);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}
