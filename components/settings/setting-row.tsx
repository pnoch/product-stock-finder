import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function SettingRow({
  icon,
  label,
  description,
  descriptionColor,
  right,
}: {
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  label: string;
  description?: string;
  descriptionColor?: string;
  right: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: colors.primary + "22",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <IconSymbol name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.foreground, fontWeight: "500", fontSize: 15 }}
        >
          {label}
        </Text>
        {description && (
          <Text
            style={{
              color: descriptionColor ?? colors.muted,
              fontSize: 12,
              marginTop: 1,
            }}
          >
            {description}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}
