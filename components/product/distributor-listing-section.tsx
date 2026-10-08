import { useEffect, useRef, useState } from "react";
import {
  Switch,
  Text,
  View,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import { formatPrice } from "@shared/currency";
import { formatEstimate } from "@/lib/estimate-format";
import { findCheapestInStockListing } from "@/lib/best-deal";
import { getDistributorById } from "@shared/distributors";
import { BestDistributorCard } from "@/components/best-distributor-card";
import type { Product } from "@/lib/types";
import type { BestDeal } from "@/lib/best-deal";
import type { Destination } from "@/lib/landed-cost";
import { CountryPicker } from "@/components/ui/country-picker";
import { getCountry } from "@shared/countries";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { openListingUrl } from "@/lib/listing-utils";
import { DistributorListingCard } from "./distributor-listing-card";

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
  onWatchAny?: () => void;
  watchingAny?: boolean;
}

function InsightSkeleton() {
  const colors = useColors();
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return (
    <Animated.View
      style={{
        opacity,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginTop: 12,
      }}
    >
      <View style={{ height: 10, width: 72, borderRadius: 6, backgroundColor: colors.border }} />
      <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.border, marginTop: 10, width: "94%" }} />
      <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.border, marginTop: 8, width: "78%" }} />
      <View style={{ height: 12, borderRadius: 6, backgroundColor: colors.border, marginTop: 8, width: "62%" }} />
    </Animated.View>
  );
}

function BestDealSkeleton() {
  const colors = useColors();
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return (
    <Animated.View
      style={{
        opacity,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ height: 10, width: 140, borderRadius: 6, backgroundColor: colors.border }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <View style={{ height: 16, width: 120, borderRadius: 6, backgroundColor: colors.border }} />
        <View style={{ height: 20, width: 80, borderRadius: 10, backgroundColor: colors.border }} />
      </View>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
        <View style={{ height: 10, flex: 1, borderRadius: 6, backgroundColor: colors.border }} />
        <View style={{ height: 10, flex: 1, borderRadius: 6, backgroundColor: colors.border }} />
        <View style={{ height: 10, flex: 1, borderRadius: 6, backgroundColor: colors.border }} />
      </View>
    </Animated.View>
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
    return findCheapestInStockListing(orderable, displayCurrency ?? "USD");
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
      {sortedListings.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 24,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 14 }}>
            No distributor data available yet.
          </Text>
          {onFindPrices && (
            <TouchableOpacity activeOpacity={0.85}
              onPress={onFindPrices}
              disabled={findingPrices}
              style={{
                marginTop: 12,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 16,
                backgroundColor: colors.primary,
                opacity: findingPrices ? 0.6 : 1,
              }}
              accessibilityLabel="Find prices"
              accessibilityRole="button"
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                {findingPrices ? "Finding prices…" : "Find prices"}
              </Text>
            </TouchableOpacity>
          )}
          {onWatchAny && (
            <TouchableOpacity activeOpacity={0.85}
              onPress={onWatchAny}
              style={{
                marginTop: 12,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: watchingAny ? colors.success : colors.primary,
              }}
              accessibilityLabel={watchingAny ? "Stop watching all distributors" : "Watch for restock across all distributors"}
              accessibilityRole="button"
            >
              <Text style={{ color: watchingAny ? colors.success : colors.primary, fontWeight: "600", fontSize: 13 }}>
                {watchingAny ? "Watching — tap to stop" : "Watch anyway"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : visibleListings.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 24,
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 14 }}>
            No distributors in {regionFilter}.
          </Text>
          <TouchableOpacity activeOpacity={0.85}
            onPress={() => onSetRegionFilter("all")}
            style={{
              marginTop: 12,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 16,
              backgroundColor: colors.primary,
            }}
            accessibilityLabel="Show all regions"
            accessibilityRole="button"
          >
            <Text
              style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}
            >
              Show All
            </Text>
          </TouchableOpacity>
        </View>
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
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                marginTop: 12,
              }}
            >
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                AI insight
              </Text>
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 14,
                  marginTop: 4,
                  lineHeight: 20,
                }}
              >
                {insight}
              </Text>
            </View>
          ) : null}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 14,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <TouchableOpacity activeOpacity={0.85}
              onPress={() => setPickerVisible(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                minHeight: 44,
              }}
              accessibilityLabel="Choose shipping country"
              accessibilityRole="button"
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <IconSymbol name="globe" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", letterSpacing: 0.5 }}>
                    SHIP TO
                  </Text>
                  <Text
                    style={{
                      color: selectedCountry ? colors.foreground : colors.muted,
                      fontSize: 15,
                      fontWeight: "600",
                    }}
                  >
                    {selectedCountry ? selectedCountry.name : "Choose country"}
                  </Text>
                </View>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </TouchableOpacity>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 8,
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Text style={{ color: colors.foreground, fontSize: 13, flex: 1, marginRight: 12 }}>
                Tax-exempt (VAT/EORI)
              </Text>
              <Switch
                value={taxExempt}
                onValueChange={onToggleTaxExempt}
                trackColor={{ false: colors.border, true: colors.primary + "88" }}
                thumbColor={taxExempt ? colors.primary : colors.muted}
                accessibilityLabel="Tax-exempt"
                accessibilityRole="switch"
              />
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 4,
              }}
            >
              <Text style={{ color: colors.foreground, fontSize: 13, flex: 1, marginRight: 12 }}>
                Include import estimate
              </Text>
              <Switch
                value={includeImportEstimate}
                onValueChange={onToggleImportEstimate}
                trackColor={{ false: colors.border, true: colors.primary + "88" }}
                thumbColor={includeImportEstimate ? colors.primary : colors.muted}
                accessibilityLabel="Include import estimate"
                accessibilityRole="switch"
              />
            </View>
          </View>
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
          <View
            style={{
              flexDirection: "row",
              marginBottom: 12,
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {["all", ...regions].map((region) => (
              <TouchableOpacity activeOpacity={0.85}
                key={region}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                onPress={() => onSetRegionFilter(region)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  minHeight: 44,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor:
                    regionFilter === region
                      ? colors.primary
                      : colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                accessibilityLabel={`Filter by ${region === "all" ? "all regions" : region}`}
                accessibilityRole="button"
                accessibilityState={{ selected: regionFilter === region }}
              >
                <Text
                  style={{
                    color:
                      regionFilter === region ? "#fff" : colors.foreground,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  {region === "all" ? "All" : region}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {!bestDeal && insightLoading && sortedListings.length > 0 ? (
            <BestDealSkeleton />
          ) : null}
          {bestDeal && (
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
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  fontWeight: "600",
                  letterSpacing: 0.5,
                }}
              >
                {destination
                  ? `BEST DEAL (to ${selectedCountry?.name ?? destination.countryCode})`
                  : `BEST DEAL (incl. shipping to ${shippingRegion})`}
              </Text>
              {(() => {
                const distrib = getDistributorById(bestDeal.distributorId);
                return (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 8,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.foreground,
                        fontSize: 16,
                        fontWeight: "700",
                        flex: 1,
                      }}
                    >
                      {distrib?.countryCode}{" "}
                      {distrib?.name ?? bestDeal.distributorId}
                    </Text>
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 18,
                        fontWeight: "700",
                      }}
                    >
                      {destination
                        ? formatEstimate(bestDeal.total, bestDeal.currency)
                        : formatPrice(bestDeal.total, bestDeal.currency)}
                    </Text>
                  </View>
                );
              })()}
              <View
                style={{ flexDirection: "row", marginTop: 8, gap: 16 }}
              >
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Price: {formatPrice(bestDeal.price, bestDeal.currency)}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Tax:{" "}
                  {bestDeal.tax > 0
                    ? formatPrice(bestDeal.tax, bestDeal.currency)
                    : "Tax-free"}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Ship:{" "}
                  {bestDeal.shipping === null
                    ? "N/A"
                    : destination
                      ? formatEstimate(bestDeal.shipping, bestDeal.currency)
                      : formatPrice(bestDeal.shipping, bestDeal.currency)}
                </Text>
              </View>
              {destination && (
                <>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                    {formatPrice(bestDeal.price, bestDeal.currency)} +{" "}
                    {formatEstimate(bestDeal.shipping ?? 0, bestDeal.currency)}
                    {bestDeal.tax > 0
                      ? ` + ${formatPrice(bestDeal.tax, bestDeal.currency)}`
                      : ""}
                    {bestDeal.importEstimate && bestDeal.importEstimate > 0
                      ? ` + ${formatEstimate(bestDeal.importEstimate, bestDeal.currency)}`
                      : ""}{" "}
                    = {formatEstimate(bestDeal.total, bestDeal.currency)}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                    Shipping is estimated. Check exact rates at checkout.
                  </Text>
                </>
              )}
              {(() => {
                const listing = sortedListings.find(
                  (l) => l.distributorId === bestDeal.distributorId && l.url,
                );
                if (!listing) return null;
                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    accessibilityLabel="Visit store"
                    accessibilityRole="button"
                    onPress={() => void openListingUrl(listing.url)}
                    style={{
                      marginTop: 10,
                      alignSelf: "flex-start",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 16,
                      backgroundColor: colors.primary,
                    }}
                  >
                    <IconSymbol name="arrow.up.right.square" size={14} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                      Visit store
                    </Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
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
