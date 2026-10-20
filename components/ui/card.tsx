import { View, type ViewProps } from "react-native";
import { useColors } from "@/hooks/use-colors";

export function Card({
  accent,
  style,
  children,
  ...props
}: ViewProps & { accent?: string }) {
  const colors = useColors();
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
        },
        accent
          ? { borderLeftWidth: 4, borderLeftColor: accent }
          : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
