import { Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { ConnectionStatus } from "@/lib/live-prices";

const CONFIG: Record<
  ConnectionStatus,
  { label: string; color: "success" | "warning" | "error" | "muted" }
> = {
  connected: { label: "Connected", color: "success" },
  "signed-out": { label: "Signed out", color: "warning" },
  offline: { label: "Offline", color: "error" },
  local: { label: "Local mode", color: "muted" },
};

export function ConnectionBadge({
  status,
  onPress,
}: {
  status: ConnectionStatus;
  onPress?: () => void;
}) {
  const colors = useColors();
  const c = CONFIG[status];
  const color = colors[c.color];
  return (
    <TouchableOpacity activeOpacity={0.7}
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: colors.surface,
        borderRadius: 20,
        paddingHorizontal: 11,
        height: 30,
        minWidth: 108,
        justifyContent: "center",
        borderWidth: 1,
        borderColor: c.color === "success" ? colors.success + "44" : c.color === "error" ? colors.error + "44" : c.color === "warning" ? colors.warning + "44" : colors.border,
      }}
      accessibilityLabel={onPress ? `Connection status: ${c.label}` : undefined}
      accessibilityRole={onPress ? "button" : undefined}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
          shadowColor: color,
          shadowOpacity: 0.35,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
      <Text style={{ color: c.color === "muted" ? colors.muted : color, fontSize: 12, fontWeight: "700", letterSpacing: 0.2 }}>
        {c.label}
      </Text>
    </TouchableOpacity>
  );
}
