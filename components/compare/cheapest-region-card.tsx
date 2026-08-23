import { useMemo } from "react";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import { formatPrice, convertPrice } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";

export function CheapestRegionCard({ listings }: { listings: DistributorListing[] }) {
  const colors = useColors();

  const regionBest = useMemo(() => {
    const map = new Map<
      string,
      {
        listing: DistributorListing;
        usd: number;
        distributor: ReturnType<typeof getDistributorById>;
      }
    >();
    for (const l of listings) {
      const dist = getDistributorById(l.distributorId);
      if (!dist) continue;
      const region = dist.region ?? "Other";
      const usd = convertPrice(l.price, l.currency, "USD");
      const existing = map.get(region);
      if (!existing || usd < existing.usd) {
        map.set(region, { listing: l, usd, distributor: dist });
      }
    }
    return Array.from(map.entries())
      .map(([region, data]) => ({ region, ...data }))
      .sort((a, b) => a.usd - b.usd);
  }, [listings]);

  if (regionBest.length === 0) return null;

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
        Cheapest by Region
      </Text>
      {regionBest.map((item, i) => {
        const isCheapest = i === 0;
        return (
          <View
            key={item.region}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 10,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: colors.border,
            }}
          >
            {isCheapest && (
              <View
                style={{
                  backgroundColor: colors.warning + "22",
                  borderRadius: 8,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  marginRight: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    color: colors.warning,
                    fontWeight: "700",
                  }}
                >
                  BEST
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                {item.distributor?.countryFlag} {item.region}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1 }}>
                {item.distributor?.name ?? item.listing.distributorId}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={{
                  color: isCheapest ? colors.success : colors.foreground,
                  fontWeight: "700",
                  fontSize: 14,
                }}
              >
                {formatPrice(item.listing.price, item.listing.currency)}
              </Text>
              {item.listing.currency !== "USD" && (
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  ≈ ${item.usd.toFixed(0)}
                </Text>
              )}
              <View
                style={{
                  backgroundColor:
                    item.listing.stockStatus === "in_stock"
                      ? colors.success + "22"
                      : colors.warning + "22",
                  borderRadius: 8,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  marginTop: 2,
                }}
              >
                <Text
                  style={{
                    color:
                      item.listing.stockStatus === "in_stock"
                        ? colors.success
                        : colors.warning,
                    fontSize: 10,
                    fontWeight: "600",
                  }}
                >
                  {item.listing.stockStatus === "in_stock"
                    ? "In Stock"
                    : item.listing.stockStatus === "back_order"
                      ? "Back Order"
                      : item.listing.stockStatus === "unknown"
                        ? "Unknown"
                        : "Out of Stock"}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
