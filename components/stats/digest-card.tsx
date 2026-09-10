import { memo, useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@shared/currency";
import type { DigestResult } from "@/lib/price-digest";
import type { rankDeals } from "@/lib/deal-score";
import { dealBandLabel } from "@/lib/deal-score";

type TopDeal = ReturnType<typeof rankDeals>[number];

export const DigestCard = memo(function DigestCard({
  result,
  periodLabel,
  displayCurrency,
  topDeals,
}: {
  result: DigestResult;
  periodLabel: string;
  displayCurrency: string;
  topDeals: TopDeal[];
}) {
  const colors = useColors();
  const router = useRouter();
  const empty = useMemo(
    () =>
      result.priceChanges.length === 0 &&
      result.stockChanges.length === 0 &&
      result.alertTargetsHit.length === 0 &&
      result.newProducts.length === 0 &&
      result.removedProducts.length === 0,
    [
      result.priceChanges.length,
      result.stockChanges.length,
      result.alertTargetsHit.length,
      result.newProducts.length,
      result.removedProducts.length,
    ],
  );

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 16,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 13 }}>
        Digest — {periodLabel}
      </Text>

      {result.valueDelta && (
        <View
          style={{
            flexDirection: "row",
            marginTop: 6,
            alignItems: "baseline",
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12, marginRight: 8 }}>
            {formatPrice(result.valueDelta.from, displayCurrency)} →{" "}
            {formatPrice(result.valueDelta.to, displayCurrency)}
          </Text>
          <Text
            style={{
              color:
                result.valueDelta.percent >= 0 ? colors.error : colors.success,
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            {result.valueDelta.percent >= 0 ? "+" : ""}
            {result.valueDelta.percent.toFixed(1)}%
          </Text>
        </View>
      )}

      {empty ? (
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>
          No changes in this period.
        </Text>
      ) : (
        <>
          {result.priceChanges.length > 0 && (
            <Text
              style={{
                color: colors.foreground,
                fontSize: 12,
                fontWeight: "600",
                marginTop: 10,
              }}
            >
              Price Changes
            </Text>
          )}
          {result.priceChanges.map((c) => (
            <View
              key={c.productId}
              style={{ flexDirection: "row", paddingVertical: 4, gap: 8 }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 12,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {c.name}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {formatPrice(c.from, displayCurrency)} → {formatPrice(c.to, displayCurrency)}
              </Text>
              <Text
                style={{
                  color: c.percent > 0 ? colors.error : colors.success,
                  fontSize: 12,
                  fontWeight: "600",
                  minWidth: 44,
                  textAlign: "right",
                }}
              >
                {c.percent > 0 ? "+" : ""}
                {c.percent.toFixed(0)}%
              </Text>
            </View>
          ))}

          {topDeals.length > 0 && (
            <Text
              style={{
                color: colors.foreground,
                fontSize: 12,
                fontWeight: "600",
                marginTop: 10,
              }}
            >
              Best time to buy
            </Text>
          )}
          {topDeals.map((d) => (
            <TouchableOpacity
              key={d.productId}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`View ${d.name} details`}
              onPress={() => router.push(`/product/${d.productId}`)}
              style={{ flexDirection: "row", paddingVertical: 4, gap: 8 }}
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 12,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {d.name}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {d.score}
              </Text>
              <Text
                style={{
                  color:
                    d.band === "hot"
                      ? colors.success
                      : d.band === "fair"
                        ? colors.warning
                        : colors.muted,
                  fontSize: 12,
                  fontWeight: "600",
                  minWidth: 44,
                  textAlign: "right",
                }}
              >
                {dealBandLabel(d.band)}
              </Text>
            </TouchableOpacity>
          ))}

          {result.stockChanges.length > 0 && (
            <Text
              style={{
                color: colors.foreground,
                fontSize: 12,
                fontWeight: "600",
                marginTop: 10,
              }}
            >
              Stock Changes
            </Text>
          )}
          {result.stockChanges.map((s) => (
            <Text
              key={s.productId}
              style={{ color: colors.muted, fontSize: 12, paddingVertical: 3 }}
            >
              {s.name}: {s.from} → {s.to}
            </Text>
          ))}

          {result.alertTargetsHit.length > 0 && (
            <Text
              style={{
                color: colors.foreground,
                fontSize: 12,
                fontWeight: "600",
                marginTop: 10,
              }}
            >
              🎯 Targets Hit
            </Text>
          )}
          {result.alertTargetsHit.map((t) => (
            <Text
              key={t.productId}
              style={{ color: colors.muted, fontSize: 12, paddingVertical: 3 }}
            >
              {t.name} at {formatPrice(t.price, t.currency)}
            </Text>
          ))}

          {(result.newProducts.length > 0 ||
            result.removedProducts.length > 0) && (
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>
              {result.newProducts.length > 0
                ? `➕ ${result.newProducts.length} added · `
                : ""}
              {result.removedProducts.length > 0
                ? `➖ ${result.removedProducts.length} removed`
                : ""}
            </Text>
          )}
        </>
      )}
    </View>
  );
});
DigestCard.displayName = "DigestCard";
