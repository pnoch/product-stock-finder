import { Text, View } from "react-native";
import { formatPrice } from "@shared/currency";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { IconActionButton } from "@/components/ui/icon-action-button";
import type { CriterionWatch } from "@/lib/types";

export function CriterionWatchesSection({
  watches,
  onRemove,
}: {
  watches: CriterionWatch[];
  onRemove: (id: string) => void;
}) {
  const colors = useColors();
  if (watches.length === 0) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginBottom: 10,
        }}
      >
        <IconSymbol name="bookmark.fill" size={15} color={colors.success} />
        <Text
          style={{
            color: colors.foreground,
            fontWeight: "700",
            fontSize: 14,
          }}
        >
          Watched Searches ({watches.length})
        </Text>
      </View>
      {watches.map((watch) => (
        <View
          key={watch.id}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "600",
                fontSize: 14,
              }}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              Any {watch.category ?? watch.brand ?? "product"}
              {watch.maxPrice != null
                ? ` under ${formatPrice(watch.maxPrice, watch.currency)}`
                : ""}
            </Text>
          </View>
          <IconActionButton
            name="trash.fill"
            size={16}
            color={colors.error}
            onPress={() => onRemove(watch.id)}
            accessibilityLabel="Remove watched search"
            accessibilityHint="Double tap to remove"
          />
        </View>
      ))}
    </View>
  );
}
