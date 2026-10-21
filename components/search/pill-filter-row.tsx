import { Platform, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { useColors } from "@/hooks/use-colors";

export function PillFilterRow({
  label,
  options,
  selected,
  onSelect,
  colors,
}: {
  label: string;
  options: string[];
  selected: string | null;
  onSelect: (v: string | null) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={{ flexDirection: "row", paddingHorizontal: 16, marginBottom: 8, flexWrap: "wrap", gap: 8, alignItems: "center" }}
      accessibilityRole="radiogroup"
      accessibilityLabel={`${label} filter`}
    >
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginRight: 4 }}>{label}</Text>
      <TouchableOpacity activeOpacity={0.85}
        onPress={() => {
          if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onSelect(null);
        }}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 16,
          backgroundColor: selected === null ? colors.primary : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected: selected === null }}
      >
        <Text style={{ color: selected === null ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>All</Text>
      </TouchableOpacity>
      {options.map((opt) => {
        const active = selected === opt;
        return (
          <TouchableOpacity activeOpacity={0.85}
            key={opt}
            onPress={() => {
              if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(active ? null : opt);
            }}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: active ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={{ color: active ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

