import { Text, View, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import { formatPrice, convertPrice } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import { CHART_COLORS } from "@/lib/compare-utils";

interface Props {
  listings: DistributorListing[];
  selected: Set<string>;
}

const stockLabel: Record<string, string> = {
  in_stock: "In Stock",
  back_order: "Back Order",
  out_of_stock: "Out of Stock",
  unknown: "Unknown",
};

export function CurrentPricesTable({ listings, selected }: Props) {
  const colors = useColors();

  if (selected.size === 0) {
    return (
      <View
        style={{
          marginHorizontal: 16,
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 16,
        }}
      >
        <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15, marginBottom: 8 }}>Current Prices</Text>
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 12 }}>No distributors selected</Text>
      </View>
    );
  }

  const selectedListings = listings.filter((l) =>
    selected.has(l.distributorId),
  );

  return (
    <View
      style={{
        marginHorizontal: 16,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 16,
      }}
    >
      <Text
        style={{
          color: colors.foreground,
          fontWeight: "700",
          fontSize: 15,
          marginBottom: 12,
        }}
      >
        Current Prices
      </Text>
      {selectedListings.map((l, i) => {
        const distributor = getDistributorById(l.distributorId);
        const usd = convertPrice(l.price, l.currency, "USD");
        const colorIdx = Array.from(selected).indexOf(l.distributorId);
        const color = CHART_COLORS[colorIdx % CHART_COLORS.length];
        const label = stockLabel[l.stockStatus] ?? l.stockStatus;
        const isUnknown = l.stockStatus === "unknown";
        const isPositive = l.stockStatus === "in_stock";
        return (
          <View
            key={l.distributorId}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 10,
              borderTopWidth: i > 0 ? StyleSheet.hairlineWidth : 0,
              borderTopColor: colors.border,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: color,
                marginRight: 10,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "600",
                  fontSize: 14,
                }}
              >
                {distributor?.countryFlag}{" "}
                {distributor?.name ?? l.distributorId}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {distributor?.country}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "700",
                  fontSize: 15,
                }}
              >
                {formatPrice(l.price, l.currency)}
              </Text>
              {l.currency !== "USD" && usd !== null && (
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  ≈ ${usd.toFixed(2)}
                </Text>
              )}
              <View
                style={{
                  backgroundColor: isPositive
                    ? colors.success + "22"
                    : isUnknown
                      ? colors.muted + "22"
                      : l.stockStatus === "back_order"
                        ? colors.warning + "22"
                        : colors.error + "22",
                  borderRadius: 8,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  marginTop: 2,
                }}
              >
                <Text
                  style={{
                    color: isPositive
                      ? colors.success
                      : isUnknown
                        ? colors.muted
                        : l.stockStatus === "back_order"
                          ? colors.warning
                          : colors.error,
                    fontSize: 10,
                    fontWeight: "600",
                  }}
                >
                  {label}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
