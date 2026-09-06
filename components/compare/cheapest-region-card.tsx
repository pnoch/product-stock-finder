import { useEffect, useMemo, useRef } from "react";
import { Text, View, Animated } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import { formatPrice } from "@shared/currency";
import { getDistributorById } from "@shared/distributors";
import { cheapestByRegion } from "@shared/compare-utils";

export function CheapestRegionCard({ listings, displayCurrency = "USD" }: { listings: DistributorListing[]; displayCurrency?: string }) {
  const colors = useColors();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const regionBest = useMemo(() => cheapestByRegion(listings, displayCurrency), [listings, displayCurrency]);

    if (regionBest.length === 0) {
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
        <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15, marginBottom: 8 }}>Cheapest by Region</Text>
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 12 }}>No in-stock regions</Text>
      </View>
    );
  }

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
        const distributor = getDistributorById(item.listing.distributorId);
        const RowWrapper: any = isCheapest ? Animated.View : View;
        const rowStyle: any = {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 10,
          borderTopWidth: i > 0 ? 1 : 0,
          borderTopColor: colors.border,
          backgroundColor: isCheapest ? colors.warning + "0D" : "transparent",
          borderRadius: isCheapest ? 10 : 0,
          paddingHorizontal: isCheapest ? 8 : 0,
          marginHorizontal: isCheapest ? -8 : 0,
          transform: isCheapest ? [{ scale: pulse }] : undefined,
        };
        return (
          <RowWrapper
            key={item.region}
            style={rowStyle}
          >
            {isCheapest && (
              <View
                style={{
                  backgroundColor: colors.warning + "22",
                  borderRadius: 8,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  marginRight: 8,
                  borderWidth: 1,
                  borderColor: colors.warning + "44",
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    color: colors.warning,
                    fontWeight: "700",
                    letterSpacing: 0.6,
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
                {distributor?.countryFlag} {item.region}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1 }}>
                {distributor?.name ?? item.listing.distributorId}
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
              {item.listing.currency !== displayCurrency && (
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  ≈ {formatPrice(item.converted ?? item.usd, displayCurrency)}
                </Text>
              )}
              <View
                style={{
                  backgroundColor:
                    item.listing.stockStatus === "in_stock"
                      ? colors.success + "22"
                      : item.listing.stockStatus === "back_order"
                        ? colors.warning + "22"
                        : item.listing.stockStatus === "out_of_stock"
                          ? colors.error + "22"
                          : colors.muted + "22",
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
                        : item.listing.stockStatus === "back_order"
                          ? colors.warning
                          : item.listing.stockStatus === "out_of_stock"
                            ? colors.error
                            : colors.muted,
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
          </RowWrapper>
        );
      })}
    </View>
  );
}
