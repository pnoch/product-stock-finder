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
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: colors.surface,
        borderRadius: 20,
        paddingHorizontal: 10,
        height: 32,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        }}
      />
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>
        {c.label}
      </Text>
    </TouchableOpacity>
  );
}
