import { Text, View, TouchableOpacity } from "react-native";
import { BackOrderReminder } from "@/lib/types";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

type StockWatchCardProps = {
  watch: BackOrderReminder;
  onDelete: (watch: BackOrderReminder) => void;
};

export function StockWatchCard({ watch, onDelete }: StockWatchCardProps) {
  const colors = useColors();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.warning + "44",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
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
          >
            {watch.productName}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 5,
              gap: 5,
            }}
          >
            <IconSymbol name="globe" size={13} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {watch.distributorName}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 4,
              gap: 5,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  watch.lastKnownStatus === "in_stock"
                    ? colors.success
                    : colors.warning,
              }}
            />
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {watch.lastKnownStatus === "back_order"
                ? "Back Order"
                : watch.lastKnownStatus === "out_of_stock"
                  ? "Out of Stock"
                  : watch.lastKnownStatus === "in_stock"
                    ? "In Stock"
                    : "Unknown"}
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 12,
                opacity: 0.5,
              }}
            >
              · last checked
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <View
            style={{
              backgroundColor: colors.warning + "22",
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text
              style={{
                color: colors.warning,
                fontSize: 11,
                fontWeight: "600",
              }}
            >
              👀 Watching
            </Text>
          </View>
          <TouchableOpacity activeOpacity={0.7}
            onPress={() => onDelete(watch)}
            style={{ padding: 4 }}
            accessibilityLabel={`Delete stock watch for ${watch.productName}`}
            accessibilityRole="button"
            accessibilityHint="Double tap to delete"
          >
            <IconSymbol
              name="trash.fill"
              size={16}
              color={colors.error}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
