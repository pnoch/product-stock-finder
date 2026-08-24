import { useState, useEffect } from "react";
import { Text, View, TouchableOpacity, Image } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { Product, TagDefinition } from "@/lib/types";
import { formatPrice, convertPrice, getBestPrice } from "@/lib/currency";
import { StockBadge } from "@/components/stock-badge";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { fetchProductImage } from "@/lib/server-images";
import {
  formatLastRefreshed,
  getLastRefreshedColor,
} from "@/lib/last-refreshed";
import { getTagById } from "@/lib/tags";
import { productStatus } from "@/lib/watchlist-org";

export function ProductCard({
  product,
  onPress,
  onDelete,
  onTagPress,
  tagDefinitions,
  selectionMode = false,
  selected = false,
  onLongPress,
  insight,
}: {
  product: Product;
  onPress: () => void;
  onDelete: () => void;
  onTagPress: () => void;
  tagDefinitions: Record<string, TagDefinition>;
  selectionMode?: boolean;
  selected?: boolean;
  onLongPress?: () => void;
  insight?: { atAllTimeLow: boolean; dropStreak: number };
}) {
  const colors = useColors();
  const bestPrice = getBestPrice(product.listings ?? [], "USD");
  const bestStatus = productStatus(product);
  const distributorCount = product.listings?.length ?? 0;
  const validTags = (product.tags ?? []).filter((id) =>
    getTagById(tagDefinitions, id),
  );

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetchProductImage(product.id).then((res) => {
      if (active && res) setImageUrl(res.imageUrl);
    });
    return () => {
      active = false;
    };
  }, [product.id]);

  return (
    <TouchableOpacity
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: selectionMode ? 2 : 1,
        borderColor: selected ? colors.primary : colors.border,
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        {selectionMode && (
          <View
            style={{
              width: 26,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8,
            }}
          >
            <IconSymbol
              name={selected ? "checkmark.circle.fill" : "circle.fill"}
              size={22}
              color={selected ? colors.primary : colors.muted}
            />
          </View>
        )}
        {imageUrl && (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: 48, height: 48, borderRadius: 8, marginRight: 10 }}
          />
        )}
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "700",
              fontSize: 15,
            }}
            numberOfLines={2}
          >
            {product.name}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
            {product.modelNumber}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
            {product.brand} · {product.category}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <StockBadge status={bestStatus} />
          {bestPrice && (
            <Text
              style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}
            >
              {formatPrice(bestPrice.price, bestPrice.currency)}
            </Text>
          )}
          {(() => {
            if (!bestPrice) return null;
            const allHistory = (product.listings ?? []).flatMap(
              (l) => l.priceHistory ?? [],
            );
            if (allHistory.length < 2) return null;
            const sorted = [...allHistory].sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
            );
            const oldestUsd = convertPrice(
              sorted[0].price,
              sorted[0].currency,
              "USD",
            );
            const currentUsd = bestPrice.price;
            if (oldestUsd <= 0) return null;
            const pct = ((currentUsd - oldestUsd) / oldestUsd) * 100;
            if (Math.abs(pct) < 0.5) return null;
            const isDown = pct < 0;
            return (
              <Text
                style={{
                  color: isDown ? colors.success : colors.error,
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                {isDown ? "▼" : "▲"} {Math.abs(pct).toFixed(1)}%
              </Text>
            );
          })()}
        </View>
      </View>
      {validTags.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 10,
          }}
        >
          {validTags.slice(0, 3).map((id) => {
            const tag = getTagById(tagDefinitions, id);
            if (!tag) return null;
            return (
              <View
                key={id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  borderRadius: 10,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: tag.color,
                    marginRight: 5,
                  }}
                />
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {tag.name}
                </Text>
              </View>
            );
          })}
          {validTags.length > 3 && (
            <Text
              style={{
                color: colors.muted,
                fontSize: 11,
                alignSelf: "center",
              }}
            >
              +{validTags.length - 3}
            </Text>
          )}
        </View>
      )}
      {insight && (insight.atAllTimeLow || insight.dropStreak >= 2) && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 6,
            marginTop: validTags.length > 0 ? 6 : 10,
          }}
        >
          {insight.atAllTimeLow && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: colors.success + "22",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text
                style={{
                  color: colors.success,
                  fontSize: 10,
                  fontWeight: "700",
                }}
              >
                🏅 All-time low
              </Text>
            </View>
          )}
          {insight.dropStreak >= 2 && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: colors.primary + "22",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 10,
                  fontWeight: "700",
                }}
              >
                ▼ Dropping ×{insight.dropStreak}
              </Text>
            </View>
          )}
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 12,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {distributorCount} distributor{distributorCount !== 1 ? "s" : ""}{" "}
          tracked
        </Text>
        {(() => {
          const refreshColor = getLastRefreshedColor(product.lastRefreshed);
          const colorMap = {
            green: colors.success,
            yellow: colors.warning,
            red: colors.error,
            gray: colors.muted,
          };
          return (
            <Text style={{ color: colorMap[refreshColor], fontSize: 11 }}>
              Updated {formatLastRefreshed(product.lastRefreshed)}
            </Text>
          );
        })()}
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onTagPress();
          }}
          style={{ padding: 4, marginRight: 4 }}
        >
          <IconSymbol
            name="tag.fill"
            size={16}
            color={(product.tags?.length ?? 0) > 0 ? colors.primary : colors.muted}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{ padding: 4 }}
        >
          <IconSymbol name="trash.fill" size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
