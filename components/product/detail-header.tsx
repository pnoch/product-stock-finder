import { Animated, Pressable, Text, View } from "react-native";
import { StockBadge } from "@/components/stock-badge";
import { getDistributorById } from "@shared/distributors";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { Product } from "@/lib/types";
import type { BestDeal } from "@/lib/best-deal";

export function DetailHeader({
  product,
  bestDeal,
  scrollY,
  watchingAny,
  onToggleWatch,
  acquired,
  onToggleAcquired,
}: {
  product: Product;
  bestDeal: BestDeal | null;
  scrollY?: Animated.Value;
  watchingAny: boolean;
  onToggleWatch: () => void;
  acquired: boolean;
  onToggleAcquired: () => void;
}) {
  const colors = useColors();
  const region = bestDeal
    ? getDistributorById(bestDeal.distributorId)?.region
    : product.listings?.[0]
      ? getDistributorById(product.listings[0].distributorId)?.region
      : undefined;
  const parallaxStyle = scrollY
    ? {
        opacity: scrollY.interpolate({ inputRange: [-40, 0, 120], outputRange: [1, 1, 0.55], extrapolate: "clamp" }) as unknown as number,
        transform: [
          {
            translateY: scrollY.interpolate({ inputRange: [-80, 0, 160], outputRange: [-16, 0, 22], extrapolate: "clamp" }) as unknown as never,
          },
          {
            scale: scrollY.interpolate({ inputRange: [-80, 0, 160], outputRange: [1.04, 1, 0.98], extrapolate: "clamp" }) as unknown as never,
          },
        ],
      }
    : undefined;
  const content = (
    <View style={{ padding: 16 }}>
      <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}>{product.name}</Text>
      <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{product.brand} · {product.category} · {product.modelNumber}</Text>
      {region ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{region}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}>
      <Pressable
        onPress={onToggleWatch}
        accessibilityRole="button"
        accessibilityLabel={watchingAny ? "Stop watching all distributors" : "Watch for restock across all distributors"}
        style={{
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: watchingAny ? colors.success : colors.primary,
        }}
      >
        <IconSymbol name={watchingAny ? "bell.fill" : "bell"} size={14} color={watchingAny ? colors.success : colors.primary} />
        <Text style={{ color: watchingAny ? colors.success : colors.primary, fontWeight: "600", fontSize: 13 }}>
          {watchingAny ? "Watching — tap to stop" : "Watch for restock"}
        </Text>
      </Pressable>
      <Pressable
        onPress={onToggleAcquired}
        accessibilityRole="button"
        accessibilityLabel={acquired ? "Acquired — tap to undo" : "Mark as acquired"}
        accessibilityState={{ selected: acquired }}
        style={{
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: acquired ? colors.success : colors.primary,
        }}
      >
        <IconSymbol name="checkmark.circle.fill" size={14} color={acquired ? colors.success : colors.primary} />
        <Text style={{ color: acquired ? colors.success : colors.primary, fontWeight: "600", fontSize: 13 }}>
          {acquired ? "Acquired — tap to undo" : "Mark as acquired"}
        </Text>
      </Pressable>
      </View>
      {bestDeal ? <View style={{ marginTop: 8 }}><StockBadge status="in_stock" /></View> : null}
    </View>
  );
  if (!scrollY) return content;
  return <Animated.View style={parallaxStyle}>{content}</Animated.View>;
}
