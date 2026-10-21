import { Text, View } from "react-native";
import { formatPrice } from "@shared/currency";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { AlertCard } from "@/components/alerts/alert-card";
import { TriggeredAlertCard } from "@/components/alerts/triggered-alert-card";
import { savingAlerts } from "@/lib/alert-savings";
import type { PriceAlert } from "@/lib/types";

export type AlertsFlatItem =
  | { id: string; kind: "active"; alert: PriceAlert }
  | { id: string; kind: "divider" }
  | { id: string; kind: "savings" }
  | { id: string; kind: "triggeredHeader" }
  | { id: string; kind: "triggered"; alert: PriceAlert };

export function AlertsListRow({
  item,
  getProductName,
  onToggle,
  onDelete,
  onSnooze,
  onEdit,
  onRearm,
  totalSaved,
  displayCurrency,
  triggeredAlerts,
}: {
  item: AlertsFlatItem;
  getProductName: (productId: string) => string;
  onToggle: (alertId: string) => void;
  onDelete: (alertId: string) => void;
  onSnooze: (alertId: string) => void;
  onEdit: (alertId: string) => void;
  onRearm: (alertId: string) => void;
  totalSaved: number | null;
  displayCurrency: string;
  triggeredAlerts: PriceAlert[];
}) {
  const colors = useColors();

  if (item.kind === "active") {
    return (
      <AlertCard
        alert={item.alert}
        productName={getProductName(item.alert.productId)}
        onToggle={onToggle}
        onDelete={onDelete}
        onSnooze={onSnooze}
        onEdit={onEdit}
      />
    );
  }
  if (item.kind === "divider") {
    return (
      <View
        style={{
          height: 1,
          backgroundColor: colors.border,
          marginBottom: 16,
          marginTop: 20,
        }}
      />
    );
  }
  if (item.kind === "savings") {
    const savingCount = savingAlerts(triggeredAlerts).length;
    return (
      <View
        style={{
          backgroundColor: colors.success + "18",
          borderRadius: 16,
          padding: 14,
          marginBottom: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderWidth: 1,
          borderColor: colors.success + "44",
        }}
      >
        <IconSymbol name="star.fill" size={24} color={colors.success} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.success,
              fontWeight: "700",
              fontSize: 15,
            }}
          >
            Total Saved: {formatPrice(totalSaved ?? 0, displayCurrency)}
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: 12,
              marginTop: 2,
            }}
          >
            Across {savingCount} triggered alert{savingCount !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>
    );
  }
  if (item.kind === "triggeredHeader") {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginBottom: 12,
        }}
      >
        <IconSymbol
          name="checkmark.circle.fill"
          size={16}
          color={colors.success}
        />
        <Text
          style={{
            color: colors.foreground,
            fontWeight: "700",
            fontSize: 15,
          }}
        >
          Alert History ({triggeredAlerts.length})
        </Text>
      </View>
    );
  }
  return (
    <TriggeredAlertCard
      alert={item.alert}
      productName={getProductName(item.alert.productId)}
      onRearm={onRearm}
      onDelete={onDelete}
    />
  );
}
