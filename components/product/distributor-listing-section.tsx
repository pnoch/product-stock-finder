import {
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import {
  formatPrice,
} from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import { BestDistributorCard } from "@/components/best-distributor-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { Product } from "@/lib/types";
import type { BestDeal } from "@/lib/best-deal";
import { DistributorListingCard } from "./distributor-listing-card";

interface DistributorListingSectionProps {
  sortedListings: DistributorListing[];
  visibleListings: DistributorListing[];
  bestInStockListing: DistributorListing | null;
  product: Product;
  insight: string | null;
  regionFilter: string;
  regions: string[];
  shippingRegion: string;
  bestDeal: BestDeal | null;
  stockWatches: Record<string, boolean>;
  id: string;
  onSetRegionFilter: (region: string) => void;
  onSetBestAlert: (listing: DistributorListing) => void;
  onToggleStockWatch: (listing: DistributorListing) => void;
  onOpenChart: (listing: DistributorListing) => void;
}

export function DistributorListingSection({
  sortedListings,
  visibleListings,
  bestInStockListing,
  product,
  insight,
  regionFilter,
  regions,
  shippingRegion,
  bestDeal,
  stockWatches,
  id,
  onSetRegionFilter,
  onSetBestAlert,
  onToggleStockWatch,
  onOpenChart,
}: DistributorListingSectionProps) {
  const colors = useColors();

  return (
    <View style={{ paddingHorizontal: 16 }}>
      <Text
        style={{
          color: colors.foreground,
          fontWeight: "700",
          fontSize: 16,
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
          <TouchableOpacity
            onPress={() => onSetRegionFilter("all")}
            style={{
              marginTop: 12,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 16,
              backgroundColor: colors.primary,
            }}
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
          {bestInStockListing && (
            <BestDistributorCard
              listing={bestInStockListing}
              product={product}
              onSetAlert={() => onSetBestAlert(bestInStockListing)}
            />
          )}
          {insight && (
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
          )}
          {bestInStockListing && (
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
              <TouchableOpacity
                key={region}
                onPress={() => onSetRegionFilter(region)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor:
                    regionFilter === region
                      ? colors.primary
                      : colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
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
                  Ship: {formatPrice(bestDeal.shipping, bestDeal.currency)}
                </Text>
              </View>
            </View>
          )}
          {visibleListings.map((listing) => (
            <DistributorListingCard
              key={listing.distributorId}
              listing={listing}
              stockWatches={stockWatches}
              onToggleStockWatch={onToggleStockWatch}
              onOpenChart={onOpenChart}
            />
          ))}
        </>
      )}
    </View>
  );
}
