import { Text, View, TouchableOpacity, TextInput } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface CatalogSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
}

export function CatalogSearchBar({
  query,
  onQueryChange,
  onSearchSubmit,
}: CatalogSearchBarProps) {
  const colors = useColors();

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
      }}
    >
      <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder="Search by model number or brand..."
        placeholderTextColor={colors.muted}
        style={{ flex: 1, color: colors.foreground, fontSize: 15 }}
        autoFocus
        returnKeyType="search"
        onSubmitEditing={() => onSearchSubmit?.(query.trim())}
      />
      {query.length > 0 && (
        <TouchableOpacity onPress={() => onQueryChange("")} accessibilityLabel="Clear search" accessibilityRole="button">
          <IconSymbol
            name="xmark.circle.fill"
            size={18}
            color={colors.muted}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}
