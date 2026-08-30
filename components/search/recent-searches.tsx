import { Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function RecentSearches({
  searches,
  onSelect,
  onClear,
}: {
  searches: string[];
  onSelect: (query: string) => void;
  onClear: () => void;
}) {
  const colors = useColors();
  if (searches.length === 0) return null;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingTop: 7,
        }}
      >
        <IconSymbol
          name="clock.arrow.circlepath"
          size={14}
          color={colors.muted}
        />
        <Text style={{ color: colors.muted, fontSize: 12 }}>Recent</Text>
        <TouchableOpacity onPress={onClear} hitSlop={8} accessibilityLabel="Clear recent searches" accessibilityRole="button">
          <Text
            style={{
              color: colors.muted,
              fontSize: 11,
              textDecorationLine: "underline",
            }}
          >
            Clear
          </Text>
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {searches.map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => onSelect(s)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 12,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            accessibilityLabel={`Search for ${s}`}
            accessibilityRole="button"
          >
            <Text
              style={{ color: colors.foreground, fontSize: 12 }}
              numberOfLines={1}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
