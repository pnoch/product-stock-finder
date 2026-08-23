import { Text, View, TextInput, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function SearchBar({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const colors = useColors();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: 16,
        marginBottom: 10,
        paddingHorizontal: 12,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder="Search watchlist..."
        placeholderTextColor={colors.muted}
        style={{
          flex: 1,
          marginLeft: 8,
          color: colors.foreground,
          fontSize: 14,
        }}
      />
      {query.length > 0 && (
        <TouchableOpacity
          onPress={() => onQueryChange("")}
          style={{ padding: 4 }}
        >
          <IconSymbol
            name="xmark.circle.fill"
            size={16}
            color={colors.muted}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}
