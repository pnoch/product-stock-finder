import {
  Text,
  View,
  TouchableOpacity,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import {
  formatPrice,
  convertPrice,
} from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import {
  formatLastRefreshed,
  getLastRefreshedColor,
} from "@/lib/last-refreshed";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { StockBadge } from "@/components/stock-badge";
import { PriceSparkline } from "@/components/price-sparkline";
import { openListingUrl } from "@/lib/listing-utils";

interface DistributorListingCardProps {
  listing: DistributorListing;
  stockWatches: Record<string, boolean>;
  onToggleStockWatch: (listing: DistributorListing) => void;
  onOpenChart: (listing: DistributorListing) => void;
}

export function DistributorListingCard({
  listing,
  stockWatches,
  onToggleStockWatch,
  onOpenChart,
}: DistributorListingCardProps) {
  const colors = useColors();
  const distributor = getDistributorById(listing.distributorId);
  const usdPrice = convertPrice(listing.price, listing.currency, "USD");

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "600",
              fontSize: 15,
            }}
          >
            {distributor?.countryFlag}{" "}
            {distributor?.name ?? listing.distributorId}
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: 12,
              marginTop: 2,
            }}
          >
            {distributor?.country} · {distributor?.region}
          </Text>
        </View>
        <StockBadge
          status={listing.stockStatus}
          expectedDate={listing.expectedDate}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View>
          <Text
            style={{
              color: colors.primary,
              fontWeight: "700",
              fontSize: 18,
            }}
          >
            {formatPrice(listing.price, listing.currency)}
          </Text>
          {listing.currency !== "USD" && (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              ≈ {formatPrice(usdPrice, "USD")}
            </Text>
          )}
          {listing.taxRate != null && listing.taxRate > 0 ? (
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              +
              {formatPrice(
                listing.price * listing.taxRate,
                listing.currency,
              )}{" "}
              tax
            </Text>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              Tax-free
            </Text>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          {listing.priceHistory &&
            listing.priceHistory.length >= 2 && (
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== "web")
                    Haptics.impactAsync(
                      Haptics.ImpactFeedbackStyle.Light,
                    );
                  onOpenChart(listing);
                }}
                activeOpacity={0.7}
              >
                <PriceSparkline
                  data={listing.priceHistory}
                  width={72}
                  height={28}
                  currency={listing.currency}
                />
              </TouchableOpacity>
            )}
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(
                  Haptics.ImpactFeedbackStyle.Light,
                );
              openListingUrl(listing.url);
            }}
            style={{
              backgroundColor: colors.primary + "22",
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontWeight: "600",
                fontSize: 13,
              }}
            >
              Visit
            </Text>
            <IconSymbol
              name="arrow.up.right.square"
              size={14}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>
      {distributor?.paymentMethods && (
        <Text
          style={{
            color: colors.muted,
            fontSize: 11,
            marginTop: 8,
          }}
        >
          💳 {distributor.paymentMethods.join(" · ")}
        </Text>
      )}
      {(() => {
        const refreshColor = getLastRefreshedColor(
          listing.lastChecked,
        );
        const colorMap = {
          green: colors.success,
          yellow: colors.warning,
          red: colors.error,
          gray: colors.muted,
        };
        return (
          <Text
            style={{
              color: colorMap[refreshColor],
              fontSize: 11,
              marginTop: distributor?.paymentMethods ? 2 : 8,
            }}
          >
            🕐 Updated {formatLastRefreshed(listing.lastChecked)}
          </Text>
        );
      })()}
      {/* Watch for Restock button on back-order cards */}
      {listing.stockStatus === "back_order" && (
        <TouchableOpacity
          onPress={() => onToggleStockWatch(listing)}
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            backgroundColor: stockWatches[listing.distributorId]
              ? colors.warning + "22"
              : colors.surface,
            borderRadius: 12,
            paddingVertical: 9,
            borderWidth: 1,
            borderColor: stockWatches[listing.distributorId]
              ? colors.warning + "88"
              : colors.border,
          }}
        >
          <IconSymbol
            name={
              stockWatches[listing.distributorId]
                ? "eye.fill"
                : "eye.slash.fill"
            }
            size={15}
            color={
              stockWatches[listing.distributorId]
                ? colors.warning
                : colors.muted
            }
          />
          <Text
            style={{
              color: stockWatches[listing.distributorId]
                ? colors.warning
                : colors.muted,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            {stockWatches[listing.distributorId]
              ? "Watching for Restock"
              : "Watch for Restock"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
