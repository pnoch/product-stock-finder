import { useMemo } from "react";
import { Text, View, Pressable, Platform } from "react-native";
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
  displayCurrency = "USD",
}: {
  listing: DistributorListing;
  onSetAlert: () => void;
  product: { name: string } | null;
  displayCurrency?: string;
}) {
  const colors = useColors();
  const distributor = getDistributorById(listing.distributorId);
  const usdPrice = convertPrice(listing.price, listing.currency, "USD");

  const derivedColors = useMemo(
    () => ({
      primary12: colors.primary + "18",
      primary22: colors.primary + "22",
      primary44: colors.primary + "44",
      primary55: colors.primary + "66",
      success18: colors.success + "22",
      success22: colors.success + "22",
      success44: colors.success + "44",
      error22: colors.error + "22",
    }),
    [colors.primary, colors.success, colors.error],
  );

  // Price-drop indicator: compare oldest vs current price in history
  const priceTrend = useMemo(() => {
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
  }, [listing.priceHistory]);

  // Lowest Price Ever: compare current price against minimum across all
  // prior history points (excluding the current point)
  const isLowestEver = useMemo(() => {
    const hist = listing.priceHistory;
    if (!hist || hist.length < 2) return false;
    const priorPoints = hist
      .slice(0, -1)
      .map((p) => convertPrice(p.price, p.currency, "USD"))
      .filter((v): v is number => v !== null);
    if (priorPoints.length === 0) return false;
    const priorMin = Math.min(...priorPoints);
    const currentUsd = convertPrice(listing.price, listing.currency, "USD");
    if (currentUsd === null) return false;
    return currentUsd < priorMin;
  }, [listing.priceHistory, listing.price, listing.currency]);

  return (
    <View
      style={{
        backgroundColor: derivedColors.primary12,
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
        borderWidth: 1.5,
        borderColor: derivedColors.primary55,
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
            backgroundColor: colors.warning,
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
                  ? derivedColors.success22
                  : derivedColors.error22,
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
            backgroundColor: derivedColors.success18,
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 5,
            marginBottom: 10,
            alignSelf: "flex-start",
            borderWidth: 1,
            borderColor: derivedColors.success44,
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
            {distributor?.country ?? "—"} · {distributor?.region ?? "—"}
          </Text>
        </View>
        <View
          style={{
            backgroundColor: derivedColors.success22,
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
          {listing.currency !== "USD" && usdPrice !== null && (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              ≈ {formatPrice(usdPrice, "USD")}
            </Text>
          )}
          {displayCurrency !== listing.currency &&
            (() => {
              const rate = convertPrice(1, listing.currency, displayCurrency);
              return rate !== null ? (
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                  1 {listing.currency} = {rate.toFixed(4)} {displayCurrency}
                </Text>
              ) : null;
            })()}
        </View>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            openListingUrl(listing.url);
          }}
          android_ripple={{ color: "#ffffff33" }}
          style={({ pressed }) => ({
            backgroundColor: colors.primary,
            borderRadius: 20,
            paddingHorizontal: 18,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            opacity: pressed ? 0.85 : 1,
            overflow: "hidden",
          })}
          accessibilityLabel="Buy now from distributor"
          accessibilityRole="button"
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Buy Now</Text>
          <IconSymbol name="arrow.up.right.square" size={14} color="#fff" />
        </Pressable>
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
          <Pressable
            onPress={onSetAlert}
            android_ripple={{ color: colors.primary + "22" }}
            style={({ pressed }) => ({
              marginTop: 10,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: colors.surface,
              borderRadius: 12,
              paddingVertical: 9,
              borderWidth: 1,
              borderColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
              overflow: "hidden",
            })}
            accessibilityLabel={`Set alert at ${formatPrice(suggestedPrice, listing.currency)}`}
            accessibilityRole="button"
          >
            <IconSymbol name="bell.fill" size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
              Set Alert at {formatPrice(suggestedPrice, listing.currency)} (−5%)
            </Text>
          </Pressable>
        );
      })()}
    </View>
  );
}

export { BestDistributorCard };
