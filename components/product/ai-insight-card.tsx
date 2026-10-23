import { Text, View } from "react-native";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function AiInsightCard({
  colors,
  insight,
}: {
  colors: Colors;
  insight: string;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginTop: 12,
      }}
    >
      <Text
        style={{
          color: colors.muted,
          fontSize: 12,
          fontWeight: "600",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        AI insight
      </Text>
      <Text
        style={{
          color: colors.foreground,
          fontSize: 14,
          marginTop: 4,
          lineHeight: 20,
        }}
      >
        {insight}
      </Text>
    </View>
  );
}
