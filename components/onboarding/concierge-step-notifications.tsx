import { Switch, Text, TouchableOpacity, View } from "react-native";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function ConciergeStepNotifications({
  colors,
  notifyDrops,
  onNotifyDropsChange,
  notifyStock,
  onNotifyStockChange,
  notifyDigest,
  onNotifyDigestChange,
  onBack,
  onNext,
}: {
  colors: Colors;
  notifyDrops: boolean;
  onNotifyDropsChange: (value: boolean) => void;
  notifyStock: boolean;
  onNotifyStockChange: (value: boolean) => void;
  notifyDigest: boolean;
  onNotifyDigestChange: (value: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 32 }}>
      <Text
        accessibilityRole="header"
        style={{
          color: colors.foreground,
          fontSize: 28,
          fontWeight: "700",
          textAlign: "center",
          marginTop: 8,
        }}
      >
        How should we notify you?
      </Text>
      <Text
        style={{
          color: colors.muted,
          fontSize: 15,
          textAlign: "center",
          marginTop: 10,
          lineHeight: 22,
        }}
      >
        Smart defaults are on — tune them any time in Settings.
      </Text>

      {(
        [
          {
            title: "Price drops",
            body: "Alert me when a tracked product drops below my target.",
            value: notifyDrops,
            set: onNotifyDropsChange,
            label: "Price drop notifications",
          },
          {
            title: "Back in stock",
            body: "Watch for restocks across all distributors.",
            value: notifyStock,
            set: onNotifyStockChange,
            label: "Back in stock notifications",
          },
          {
            title: "Price digest",
            body: "A periodic roundup of price moves.",
            value: notifyDigest,
            set: onNotifyDigestChange,
            label: "Price digest notifications",
          },
        ] as const
      ).map((row) => (
        <View
          key={row.title}
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 16,
            padding: 16,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}>
              {row.title}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
              {row.body}
            </Text>
          </View>
          <Switch
            value={row.value}
            onValueChange={row.set}
            trackColor={{ false: colors.border, true: colors.primary + "88" }}
            thumbColor={row.value ? colors.primary : colors.muted}
            accessibilityLabel={row.label}
            accessibilityRole="switch"
          />
        </View>
      ))}

      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 32 }}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onBack}
          style={{
            flex: 1,
            paddingVertical: 15,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
          }}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 16 }}>
            Back
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onNext}
          style={{
            flex: 2,
            paddingVertical: 15,
            borderRadius: 14,
            backgroundColor: colors.primary,
            alignItems: "center",
          }}
          accessibilityLabel="Continue"
          accessibilityRole="button"
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
