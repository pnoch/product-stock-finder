import type { JSX } from "react";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { Scarcity } from "@/lib/availability";

const SCARCITY_LABEL: Record<Scarcity, string> = {
  rare: "Rare",
  occasional: "Occasional",
  common: "Usually available",
};

export function ScarcityBadge({
  scarcity,
}: {
  scarcity: Scarcity;
}): JSX.Element {
  const colors = useColors();
  const color =
    scarcity === "rare"
      ? colors.error
      : scarcity === "occasional"
        ? colors.warning
        : colors.success;
  const label = SCARCITY_LABEL[scarcity];

  return (
    <View
      style={{
        backgroundColor: color + "22",
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
      accessibilityLabel={`Availability: ${label}`}
    >
      <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}
