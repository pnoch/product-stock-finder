import { Text, TouchableOpacity, View } from "react-native";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function RegionFilterRow({
  colors,
  regions,
  regionFilter,
  onSetRegionFilter,
}: {
  colors: Colors;
  regions: string[];
  regionFilter: string;
  onSetRegionFilter: (region: string) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        marginBottom: 12,
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      {["all", ...regions].map((region) => (
        <TouchableOpacity
          activeOpacity={0.85}
          key={region}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={() => onSetRegionFilter(region)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            minHeight: 44,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: regionFilter === region ? colors.primary : colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
          accessibilityLabel={`Filter by ${region === "all" ? "all regions" : region}`}
          accessibilityRole="button"
          accessibilityState={{ selected: regionFilter === region }}
        >
          <Text
            style={{
              color: regionFilter === region ? "#fff" : colors.foreground,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            {region === "all" ? "All" : region}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
