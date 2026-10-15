import { memo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatPrice } from "@shared/currency";
import type { PriceAlert } from "@/lib/types";
import { formatDropPct, type PriceDrop } from "@/lib/price-leaderboard";

function CardShell({
  accent,
  children,
}: {
  accent: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderLeftWidth: 4,
        borderLeftColor: accent,
      }}
    >
      {children}
    </View>
  );
}

function CardTitle({
  icon,
  iconColor,
  title,
}: {
  icon: "bell.fill" | "chart.line.downtrend.xyaxis" | "checkmark.circle.fill";
  iconColor: string;
  title: string;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <IconSymbol name={icon} size={20} color={iconColor} />
      <Text
        accessibilityRole="header"
        style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}
      >
        {title}
      </Text>
    </View>
  );
}

export const AlertFiredCard = memo(function AlertFiredCard({
  alerts,
  names,
  onView,
  onRearm,
}: {
  alerts: PriceAlert[];
  names: Map<string, string>;
  onView: (productId: string) => void;
  onRearm: (alertId: string) => void;
}) {
  const colors = useColors();
  return (
    <CardShell accent={colors.error}>
      <CardTitle icon="bell.fill" iconColor={colors.error} title="Alerts fired" />
      <View style={{ marginTop: 8 }}>
        {alerts.map((alert, index) => (
          <View
            key={alert.id}
            style={{
              paddingVertical: 8,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.border,
            }}
          >
            <Text
              numberOfLines={1}
              style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}
            >
              {names.get(alert.productId) ?? "Unknown Product"}
            </Text>
            {alert.triggeredPrice != null ? (
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                Hit {formatPrice(alert.triggeredPrice, alert.currency)} (target{" "}
                {formatPrice(alert.targetPrice, alert.currency)})
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 16, marginTop: 6 }}>
              <TouchableOpacity
                onPress={() => onView(alert.productId)}
                accessibilityLabel={`View ${names.get(alert.productId) ?? "product"}`}
                accessibilityRole="button"
              >
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
                  View
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onRearm(alert.id)}
                accessibilityLabel="Re-arm alert"
                accessibilityRole="button"
              >
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>
                  Re-arm
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </CardShell>
  );
});

export const DropCard = memo(function DropCard({
  drops,
}: {
  drops: PriceDrop[];
}) {
  const colors = useColors();
  const router = useRouter();
  return (
    <CardShell accent={colors.success}>
      <CardTitle icon="chart.line.downtrend.xyaxis" iconColor={colors.success} title="Biggest drops" />
      <View style={{ marginTop: 8 }}>
        {drops.map((drop, index) => (
          <TouchableOpacity
            key={`${drop.productId}:${drop.distributorId}`}
            onPress={() => router.push(`/product/${drop.productId}`)}
            accessibilityLabel={`View ${drop.productName}`}
            accessibilityRole="button"
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 8,
              minHeight: 56,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.border,
            }}
          >
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {drop.productName}
              </Text>
              <Text
                style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {drop.distributorName}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.success }}>
                {formatDropPct(drop.dropPct)}
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                {`\u2212${formatPrice(drop.dropAbs, drop.currency)}`}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        onPress={() => router.push("/drops")}
        accessibilityLabel="See all price drops"
        accessibilityRole="button"
        style={{ marginTop: 8, alignSelf: "flex-end" }}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>
          See all →
        </Text>
      </TouchableOpacity>
    </CardShell>
  );
});

export const RestockCard = memo(function RestockCard({
  productIds,
  names,
  onView,
}: {
  productIds: string[];
  names: Map<string, string>;
  onView: (productId: string) => void;
}) {
  const colors = useColors();
  return (
    <CardShell accent={colors.success}>
      <CardTitle icon="checkmark.circle.fill" iconColor={colors.success} title="Back in stock" />
      <View style={{ marginTop: 8 }}>
        {productIds.map((id, index) => (
          <TouchableOpacity
            key={id}
            onPress={() => onView(id)}
            accessibilityLabel={`View ${names.get(id) ?? "product"}`}
            accessibilityRole="button"
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 8,
              minHeight: 56,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.border,
            }}
          >
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text
                numberOfLines={1}
                style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}
              >
                {names.get(id) ?? "Unknown Product"}
              </Text>
              <Text style={{ color: colors.success, fontSize: 12, marginTop: 2 }}>
                Back in stock
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={18} color={colors.muted} />
          </TouchableOpacity>
        ))}
      </View>
    </CardShell>
  );
});

export const QuietCard = memo(function QuietCard({
  dropCount,
}: {
  dropCount: number;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: "center",
      }}
    >
      <IconSymbol name="checkmark.circle.fill" size={28} color={colors.success} />
      <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", marginTop: 8 }}>
        All quiet
      </Text>
      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4, textAlign: "center" }}>
        {dropCount > 0
          ? `${dropCount} price${dropCount === 1 ? "" : "s"} fell this week.`
          : "We'll let you know when something moves."}
      </Text>
    </View>
  );
});
