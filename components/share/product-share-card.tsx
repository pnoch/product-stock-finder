import { forwardRef } from "react";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { formatPrice } from "@shared/currency";
import type { ShareRow } from "@/lib/price-share";

export const ProductShareCard = forwardRef<
  View,
  {
    productName: string;
    modelNumber: string;
    rows: ShareRow[];
    currency: string;
    bestUrl: string;
  }
>(function ProductShareCard(
  { productName, modelNumber, rows, currency },
  ref,
) {
  const colors = useColors();

  return (
    <View
      ref={ref}
      style={{
        width: 360,
        backgroundColor: colors.background,
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          backgroundColor: colors.primary,
          paddingVertical: 14,
          paddingHorizontal: 18,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
          Product Stock Finder
        </Text>
      </View>
      <View style={{ padding: 18 }}>
        <Text
          style={{
            color: colors.foreground,
            fontWeight: "700",
            fontSize: 18,
          }}
          numberOfLines={2}
        >
          {productName}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
          {modelNumber}
        </Text>
        <View
          style={{
            height: 1,
            backgroundColor: colors.border,
            marginVertical: 12,
          }}
        />
        {rows.map((row, i) => (
          <View
            key={`${row.name}-${i}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 7,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 15 }}>{row.flag}</Text>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 13,
                fontWeight: "500",
                flex: 1,
              }}
              numberOfLines={1}
            >
              {row.name}
            </Text>
            {i === 0 && (
              <View
                style={{
                  backgroundColor: colors.success + "33",
                  borderRadius: 8,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{ color: colors.success, fontSize: 9, fontWeight: "700" }}
                >
                  BEST
                </Text>
              </View>
            )}
            <Text
              style={{
                color: i === 0 ? colors.success : colors.foreground,
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              {formatPrice(row.price, currency)}
            </Text>
          </View>
        ))}
        <Text style={{ color: colors.muted, fontSize: 10, marginTop: 10 }}>
          via Product Stock Finder
        </Text>
      </View>
    </View>
  );
});
