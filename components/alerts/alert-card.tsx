import { memo, useMemo, useCallback } from "react";
import { Text, View, Switch } from "react-native";
import { PriceAlert } from "@/lib/types";
import { formatPrice } from "@shared/currency";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { getDistributorById } from "@shared/distributors";

type AlertCardProps = {
  alert: PriceAlert;
  productName: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSnooze?: (id: string) => void;
  onEdit?: (id: string) => void;
};

export const AlertCard = memo(function AlertCard({
  alert,
  productName,
  onToggle,
  onDelete,
  onSnooze,
  onEdit,
}: AlertCardProps) {
  const colors = useColors();
  const snoozed = useMemo(
    () => !!alert.snoozedUntil && new Date(alert.snoozedUntil) > new Date(),
    [alert.snoozedUntil],
  );
  const distributorLabel = useMemo(() => {
    if (!alert.distributorId) return null;
    const dist = getDistributorById(alert.distributorId);
    return dist ? `${dist.countryFlag} ${dist.name}` : alert.distributorId;
  }, [alert.distributorId]);
  const handleToggle = useCallback(() => onToggle(alert.id), [onToggle, alert.id]);
  const handleDelete = useCallback(() => onDelete(alert.id), [onDelete, alert.id]);
  const handleSnooze = useCallback(() => onSnooze?.(alert.id), [onSnooze, alert.id]);
  const handleEdit = useCallback(() => onEdit?.(alert.id), [onEdit, alert.id]);

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        opacity: snoozed ? 0.7 : 1,
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
            ellipsizeMode="tail"
          >
            {productName}
          </Text>
          {distributorLabel && (
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }} numberOfLines={1} ellipsizeMode="tail">
              {distributorLabel}
            </Text>
          )}
          {snoozed && (
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
              😴 Snoozed until{" "}
              {new Date(alert.snoozedUntil!).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
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
                {new Date(alert.triggeredAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </Text>
            </View>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          {!alert.triggeredAt && (
            <Switch
              value={alert.isActive}
              onValueChange={handleToggle}
              trackColor={{
                false: colors.border,
                true: colors.primary + "88",
              }}
              thumbColor={alert.isActive ? colors.primary : colors.muted}
              accessibilityLabel={`Toggle alert for ${productName}`}
              accessibilityRole="switch"
            />
          )}
          {onEdit && (
            <IconActionButton
              name="pencil"
              size={16}
              color={colors.primary}
              onPress={handleEdit}
              accessibilityLabel={`Edit alert for ${productName}`}
            />
          )}
          {onSnooze && !alert.triggeredAt && (
            <IconActionButton
              name="moon.zzz.fill"
              size={16}
              color={colors.muted}
              onPress={handleSnooze}
              accessibilityLabel={`Snooze alert for ${productName}`}
            />
          )}
          <IconActionButton
            name="trash.fill"
            size={16}
            color={colors.error}
            onPress={handleDelete}
            accessibilityLabel={`Delete alert for ${productName}`}
            accessibilityHint="Double tap to delete"
          />
        </View>
      </View>
    </View>
  );
});
AlertCard.displayName = "AlertCard";
