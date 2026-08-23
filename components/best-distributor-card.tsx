import { Text, View, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import { formatPrice, convertPrice } from "@/lib/currency";
import { getDistributorById } from "@/lib/distributors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { openListingUrl } from "@/lib/listing-utils";

// ─── Best Distributor Highlight Card ─────────────────────────────────────────

function BestDistributorCard({
  listing,
  onSetAlert,
  product: prod,
}: {
  listing: DistributorListing;
  onSetAlert: () => void;
  product: { name: string } | null;
}) {
  const colors = useColors();
  const distributor = getDistributorById(listing.distributorId);
  const usdPrice = convertPrice(listing.price, listing.currency, "USD");

  // Price-drop indicator: compare oldest vs current price in history
  const priceTrend = (() => {
    const hist = listing.priceHistory;
    if (!hist || hist.length < 2) return null;
    const sorted = [...hist].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const oldest = sorted[0].price;
    const current = sorted[sorted.length - 1].price;
    if (current < oldest) {
      const pct = Math.round(((oldest - current) / oldest) * 100);
      return { dir: "down" as const, pct };
    }
    if (current > oldest) {
      const pct = Math.round(((current - oldest) / oldest) * 100);
      return { dir: "up" as const, pct };
    }
    return null;
  })();

  // Lowest Price Ever: compare current price against minimum across all history points
  const isLowestEver = (() => {
    const hist = listing.priceHistory;
    if (!hist || hist.length < 2) return false;
    // Convert all prices to USD for fair comparison
    const historicalMin = Math.min(
      ...hist.map((p) => convertPrice(p.price, p.currency, "USD")),
    );
    const currentUsd = convertPrice(listing.price, listing.currency, "USD");
    return currentUsd <= historicalMin;
  })();

  return (
    <View
      style={{
        backgroundColor: colors.primary + "12",
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
        borderWidth: 1.5,
        borderColor: colors.primary + "55",
      }}
    >
      {/* Crown badge */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
        }}
      >
        <View
          style={{
            backgroundColor: "#F59E0B",
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 3,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
        >
          <IconSymbol name="crown.fill" size={12} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
            BEST PRICE
          </Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>
          Cheapest in-stock option
        </Text>
        {priceTrend && (
          <View
            style={{
              backgroundColor:
                priceTrend.dir === "down"
                  ? colors.success + "22"
                  : colors.error + "22",
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 3,
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Text
              style={{
                color:
                  priceTrend.dir === "down" ? colors.success : colors.error,
                fontSize: 11,
                fontWeight: "700",
              }}
            >
              {priceTrend.dir === "down" ? "▼" : "▲"} {priceTrend.pct}%
            </Text>
          </View>
        )}
      </View>
      {isLowestEver && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            backgroundColor: colors.success + "18",
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 5,
            marginBottom: 10,
            alignSelf: "flex-start",
            borderWidth: 1,
            borderColor: colors.success + "44",
          }}
        >
          <Text style={{ fontSize: 14 }}>🎉</Text>
          <Text
            style={{ color: colors.success, fontSize: 12, fontWeight: "700" }}
          >
            Lowest Price Ever
          </Text>
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "700",
              fontSize: 15,
            }}
          >
            {distributor?.countryFlag}{" "}
            {distributor?.name ?? listing.distributorId}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
            {distributor?.country} · {distributor?.region}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: colors.success + "22",
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text
            style={{ color: colors.success, fontSize: 12, fontWeight: "600" }}
          >
            ● In Stock
          </Text>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 10,
        }}
      >
        <View>
          <Text
            style={{ color: colors.primary, fontWeight: "700", fontSize: 22 }}
          >
            {formatPrice(listing.price, listing.currency)}
          </Text>
          {listing.currency !== "USD" && (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              ≈ {formatPrice(usdPrice, "USD")}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            openListingUrl(listing.url);
          }}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 20,
            paddingHorizontal: 18,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
            Buy Now
          </Text>
          <IconSymbol name="arrow.up.right.square" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
      {distributor?.paymentMethods && (
        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>
          💳 {distributor.paymentMethods.join(" · ")}
        </Text>
      )}
      {/* Quick-set price alert row */}
      {(() => {
        const suggestedPrice = Math.round(listing.price * 0.95 * 100) / 100;
        return (
          <TouchableOpacity
            onPress={onSetAlert}
            style={{
              marginTop: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: colors.primary + "12",
              borderRadius: 12,
              paddingVertical: 9,
              borderWidth: 1,
              borderColor: colors.primary + "44",
            }}
          >
            <IconSymbol name="bell.fill" size={14} color={colors.primary} />
            <Text
              style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}
            >
              Set Alert at {formatPrice(suggestedPrice, listing.currency)} (−5%)
            </Text>
          </TouchableOpacity>
        );
      })()}
    </View>
  );
}

export { BestDistributorCard };
