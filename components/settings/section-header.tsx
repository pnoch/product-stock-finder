import { Text } from "react-native";
import { useColors } from "@/hooks/use-colors";

export function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text
      style={{
        color: colors.muted,
        fontSize: 12,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 8,
      }}
    >
      {title}
    </Text>
  );
}
