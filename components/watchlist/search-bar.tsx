import { useState } from "react";
import { View, TextInput, TouchableOpacity, Keyboard } from "react-native";
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
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: 16,
        marginBottom: 10,
        paddingHorizontal: 12,
        minHeight: 40,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: focused ? colors.primary : colors.border,
      }}
    >
      <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder="Search watchlist..."
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={() => Keyboard.dismiss()}
        style={{
          flex: 1,
          marginLeft: 8,
          color: colors.foreground,
          fontSize: 14,
        }}
      />
      {query.length > 0 && (
        <TouchableOpacity activeOpacity={0.7}
          onPress={() => onQueryChange("")}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 4 }}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
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
