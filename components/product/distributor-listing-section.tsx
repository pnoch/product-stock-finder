import { useEffect, useRef } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import { formatPrice } from "@shared/currency";
import { convertPrice } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import { BestDistributorCard } from "@/components/best-distributor-card";
import type { Product } from "@/lib/types";
import type { BestDeal } from "@/lib/best-deal";
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
  onSetRegionFilter: (region: string) => void;
  onSetBestAlert: (listing: DistributorListing) => void;
  onToggleStockWatch: (listing: DistributorListing) => void;
  onOpenChart: (listing: DistributorListing) => void;
  onRemind?: (listing: DistributorListing) => void;
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
  onSetRegionFilter,
  onSetBestAlert,
  onToggleStockWatch,
  onOpenChart,
  onRemind,
}: DistributorListingSectionProps) {
  const colors = useColors();
  const globalBestInStockListing = (() => {
    const inStock = sortedListings.filter((l) => l.stockStatus === "in_stock");
    if (inStock.length > 0) {
      let best: DistributorListing | null = null;
      let bestConverted = Infinity;
      const target = displayCurrency ?? "USD";
      for (const l of inStock) {
        const c = convertPrice(l.price, l.currency, target);
        if (c === null || !Number.isFinite(c)) continue;
        if (c < bestConverted) {
          bestConverted = c;
          best = l;
        }
      }
      if (best) return best;
    }
    return sortedListings.find((l) => l.stockStatus !== "out_of_stock") ?? sortedListings[0] ?? null;
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
              onSetAlert={() => onSetBestAlert(globalBestInStockListing)}
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
                BEST DEAL (incl. shipping to {shippingRegion})
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
                      {distrib?.countryFlag}{" "}
                      {distrib?.name ?? bestDeal.distributorId}
                    </Text>
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 18,
                        fontWeight: "700",
                      }}
                    >
                      {formatPrice(bestDeal.total, bestDeal.currency)}
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
                  Ship: {bestDeal.shipping === null ? "N/A" : formatPrice(bestDeal.shipping, bestDeal.currency)}
                </Text>
              </View>
            </View>
          )}
          {visibleListings.map((listing) => (
            <DistributorListingCard
              key={listing.distributorId}
              listing={listing}
              displayCurrency={displayCurrency}
              stockWatches={stockWatches}
              onToggleStockWatch={onToggleStockWatch}
              onOpenChart={onOpenChart}
              onRemind={onRemind}
            />
          ))}
        </>
      )}
    </View>
  );
}
