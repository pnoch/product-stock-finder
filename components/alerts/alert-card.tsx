import { Text, View, Switch, TouchableOpacity } from "react-native";
import { PriceAlert } from "@/lib/types";
import { formatPrice } from "@/lib/currency";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getDistributorById } from "@/lib/distributors";

type AlertCardProps = {
  alert: PriceAlert;
  productName: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
};

export function AlertCard({
  alert,
  productName,
  onToggle,
  onDelete,
}: AlertCardProps) {
  const colors = useColors();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: alert.triggeredAt
          ? colors.success + "44"
          : colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "600",
              fontSize: 14,
            }}
            numberOfLines={2}
          >
            {productName}
          </Text>
          {alert.distributorId && (
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
              {(() => {
                const dist = getDistributorById(alert.distributorId!);
                return dist
                  ? `${dist.countryFlag} ${dist.name}`
                  : alert.distributorId;
              })()}
            </Text>
          )}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 6,
              gap: 6,
            }}
          >
            <IconSymbol
              name={alert.direction === "rise" ? "arrow.up" : "arrow.down"}
              size={13}
              color={
                alert.direction === "rise" ? colors.error : colors.success
              }
            />
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              Target: {formatPrice(alert.targetPrice, alert.currency)}
            </Text>
          </View>
          {alert.triggeredAt && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 4,
                gap: 6,
              }}
            >
              <IconSymbol
                name="checkmark.circle.fill"
                size={14}
                color={colors.success}
              />
              <Text style={{ color: colors.success, fontSize: 12 }}>
                Triggered{" "}
                {new Date(alert.triggeredAt).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          {!alert.triggeredAt && (
            <Switch
              value={alert.isActive}
              onValueChange={() => onToggle(alert.id)}
              trackColor={{
                false: colors.border,
                true: colors.primary + "88",
              }}
              thumbColor={alert.isActive ? colors.primary : colors.muted}
            />
          )}
          <TouchableOpacity
            onPress={() => onDelete(alert.id)}
            style={{ padding: 4 }}
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
