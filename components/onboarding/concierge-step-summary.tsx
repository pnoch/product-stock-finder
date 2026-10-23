import { Text, TouchableOpacity, View } from "react-native";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function ConciergeStepSummary({
  colors,
  selectedProducts,
  projectedAlerts,
  projectedWatches,
  pendingPreview,
  finishing,
  onBack,
  onFinish,
  maxSelection,
}: {
  colors: Colors;
  selectedProducts: { id: string; name: string }[];
  projectedAlerts: number;
  projectedWatches: number;
  pendingPreview: number;
  finishing: boolean;
  onBack: () => void;
  onFinish: () => void;
  maxSelection: number;
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
        You&apos;re all set
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
        Tracking {selectedProducts.length} product
        {selectedProducts.length === 1 ? "" : "s"} across 25 stores
      </Text>

      <View
        style={{
          marginTop: 24,
          padding: 16,
          borderRadius: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        {selectedProducts.slice(0, maxSelection).map((p) => (
          <Text
            key={p.id}
            style={{
              color: colors.foreground,
              fontSize: 14,
              fontWeight: "600",
              marginBottom: 6,
            }}
          >
            · {p.name}
          </Text>
        ))}
        <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8 }}>
          {projectedAlerts} price alert
          {projectedAlerts === 1 ? "" : "s"} · {projectedWatches} restock watch
          {projectedWatches === 1 ? "" : "es"}
        </Text>
        {pendingPreview > 0 && (
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>
            {pendingPreview} price alert
            {pendingPreview === 1 ? "" : "s"} will activate once first prices
            arrive
          </Text>
        )}
      </View>

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
          onPress={onFinish}
          disabled={finishing}
          style={{
            flex: 2,
            paddingVertical: 15,
            borderRadius: 14,
            backgroundColor: finishing ? colors.border : colors.primary,
            alignItems: "center",
          }}
          accessibilityLabel="Finish"
          accessibilityRole="button"
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
            {finishing ? "Saving…" : "Finish"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
