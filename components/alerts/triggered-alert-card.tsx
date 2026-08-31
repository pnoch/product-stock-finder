import { memo, useMemo, useCallback } from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { PriceAlert } from "@/lib/types";
import { formatPrice } from "@/lib/currency";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getDistributorById } from "@/lib/distributors";

interface TriggeredAlertCardProps {
  alert: PriceAlert;
  productName: string;
  onRearm: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TriggeredAlertCard = memo(function TriggeredAlertCard({
  alert,
  productName,
  onRearm,
  onDelete,
}: TriggeredAlertCardProps) {
  const colors = useColors();
  const distributorLabel = useMemo(() => {
    if (!alert.distributorId) return null;
    const dist = getDistributorById(alert.distributorId);
    return dist ? `${dist.countryFlag} ${dist.name}` : alert.distributorId;
  }, [alert.distributorId]);
  const handleRearm = useCallback(() => onRearm(alert.id), [onRearm, alert.id]);
  const handleDelete = useCallback(() => onDelete(alert.id), [onDelete, alert.id]);

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.success + "44",
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
          {distributorLabel && (
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
              {distributorLabel}
            </Text>
          )}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 5,
              gap: 5,
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
            {alert.triggeredPrice != null && (
              <Text
                style={{
                  color: colors.success,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                → {formatPrice(alert.triggeredPrice, alert.currency)}
              </Text>
            )}
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 4,
              gap: 5,
            }}
          >
            <IconSymbol
              name="checkmark.circle.fill"
              size={13}
              color={colors.success}
            />
            <Text style={{ color: colors.success, fontSize: 12 }}>
              Triggered{" "}
              {new Date(alert.triggeredAt!).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <TouchableOpacity
            onPress={handleRearm}
            style={{
              backgroundColor: colors.primary + "18",
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 4,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
            accessibilityLabel={`Watch again for ${productName}`}
            accessibilityRole="button"
          >
            <IconSymbol
              name="arrow.clockwise"
              size={12}
              color={colors.primary}
            />
            <Text
              style={{
                color: colors.primary,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              Watch Again
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            style={{ padding: 4 }}
            accessibilityLabel={`Delete triggered alert for ${productName}`}
            accessibilityRole="button"
          >
            <IconSymbol name="trash.fill" size={15} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});
TriggeredAlertCard.displayName = "TriggeredAlertCard";
