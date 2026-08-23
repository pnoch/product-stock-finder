import { Text, View, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function PillPicker({
  icon,
  label,
  options,
  value,
  onSelect,
}: {
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  label: string;
  options: string[];
  value: string;
  onSelect: (v: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 10,
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
        <Text
          style={{
            color: colors.foreground,
            fontWeight: "500",
            fontSize: 15,
          }}
        >
          {label}
        </Text>
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          paddingLeft: 48,
        }}
      >
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor:
                value === opt ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                color: value === opt ? "#fff" : colors.foreground,
                fontWeight: "600",
                fontSize: 13,
              }}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
