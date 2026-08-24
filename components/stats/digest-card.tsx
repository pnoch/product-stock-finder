import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@/lib/currency";
import type { DigestResult } from "@/lib/price-digest";

export function DigestCard({
  result,
  periodLabel,
}: {
  result: DigestResult;
  periodLabel: string;
}) {
  const colors = useColors();
  const empty =
    result.priceChanges.length === 0 &&
    result.stockChanges.length === 0 &&
    result.alertTargetsHit.length === 0 &&
    result.newProducts.length === 0 &&
    result.removedProducts.length === 0;

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
            {formatPrice(result.valueDelta.from, "USD")} →{" "}
            {formatPrice(result.valueDelta.to, "USD")}
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
                {formatPrice(c.from, "USD")} → {formatPrice(c.to, "USD")}
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
}
