import { Text, View, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function RadioPicker({
  icon,
  label,
  options,
  value,
  onSelect,
}: {
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  label: string;
  options: { value: string; label: string }[];
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
      <View style={{ paddingLeft: 48, gap: 8 }}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => {
              if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(opt.value);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 8,
            }}
            accessibilityLabel={`Select ${opt.label}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === opt.value }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor:
                  value === opt.value ? colors.primary : colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {value === opt.value && (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: colors.primary,
                  }}
                />
              )}
            </View>
            <Text
              style={{
                color: colors.foreground,
                fontSize: 14,
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
