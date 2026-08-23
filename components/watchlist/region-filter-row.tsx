import { Text, View, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";

export function RegionFilterRow({
  regions,
  regionFilter,
  onRegionChange,
}: {
  regions: string[];
  regionFilter: string;
  onRegionChange: (region: string) => void;
}) {
  const colors = useColors();

  return (
    <View
      style={{
        flexDirection: "row",
        paddingHorizontal: 16,
        marginBottom: 8,
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      {["all", ...regions].map((region) => (
        <TouchableOpacity
          key={region}
          onPress={() => onRegionChange(region)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            backgroundColor:
              regionFilter === region ? colors.primary : colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          }}
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
