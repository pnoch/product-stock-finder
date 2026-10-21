import { View } from "react-native";
import { useColors } from "@/hooks/use-colors";

export function SkeletonRow() {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          height: 14,
          width: "60%",
          borderRadius: 6,
          backgroundColor: colors.border,
          marginBottom: 10,
        }}
      />
      <View
        style={{
          height: 11,
          width: "35%",
          borderRadius: 6,
          backgroundColor: colors.border,
        }}
      />
    </View>
  );
}

