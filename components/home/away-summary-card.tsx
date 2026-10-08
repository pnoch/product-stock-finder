import { useState, type JSX } from "react";
import { View, Text, Pressable, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import type { AwaySummary } from "@/lib/away-summary";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

function formatPct(pct: number): string {
  const rounded = Math.round(pct);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function countLine(
  n: number,
  singular: string,
  plural: string,
): string | null {
  if (n <= 0) return null;
  return `${n} ${n === 1 ? singular : plural}`;
}

export function AwaySummaryCard({
  summary,
  onDismiss,
}: {
  summary: AwaySummary;
  onDismiss: () => void;
}): JSX.Element {
  const colors = useColors();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const counts = [
    countLine(summary.priceDrops.length, "price drop", "price drops"),
    countLine(summary.priceRises.length, "price rise", "price rises"),
    countLine(summary.restocks.length, "back in stock", "back in stock"),
    countLine(summary.stockOuts.length, "now out of stock", "now out of stock"),
  ].filter((c): c is string => c !== null);

  const items = [
    ...summary.priceDrops.map((item) => ({ item, pct: item.pct })),
    ...summary.priceRises.map((item) => ({ item, pct: item.pct })),
    ...summary.restocks.map((item) => ({ item, pct: undefined })),
    ...summary.stockOuts.map((item) => ({ item, pct: undefined })),
  ];
  const visible = expanded ? items : items.slice(0, 3);

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}
        >
          While you were away
        </Text>
        <Pressable
          onPress={onDismiss}
          accessibilityLabel="Dismiss"
          accessibilityRole="button"
          hitSlop={8}
        >
          <IconSymbol name="xmark" size={18} color={colors.muted} />
        </Pressable>
      </View>

      {counts.length > 0 ? (
        <Text style={{ fontSize: 13, color: colors.muted, marginTop: 6 }}>
          {counts.join(" · ")}
        </Text>
      ) : null}

      <View style={{ marginTop: 12 }}>
        {visible.map(({ item, pct }, index) => (
          <TouchableOpacity
            key={`${item.productId}-${item.distributorId ?? index}`}
            onPress={() => router.push(`/product/${item.productId}`)}
            accessibilityLabel={`View ${item.name}`}
            accessibilityRole="button"
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 8,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.border,
            }}
          >
            <Text
              numberOfLines={1}
              style={{ color: colors.foreground, fontSize: 14, flex: 1 }}
            >
              {item.name}
            </Text>
            {pct !== undefined ? (
              <Text
                style={{
                  color: pct < 0 ? colors.success : colors.error,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                {formatPct(pct)}
              </Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      {items.length > 3 ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityLabel={expanded ? "See less" : "See all"}
          accessibilityRole="button"
          style={{ marginTop: 10 }}
        >
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
            {expanded ? "See less" : "See all"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
