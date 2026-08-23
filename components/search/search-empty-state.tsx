import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface SearchEmptyStateProps {
  query: string;
  selectedTagIds: string[];
}

export function SearchEmptyState({ query, selectedTagIds }: SearchEmptyStateProps) {
  const colors = useColors();

  return (
    <View style={{ alignItems: "center", paddingTop: 60 }}>
      <IconSymbol name="magnifyingglass" size={40} color={colors.muted} />
      <Text
        style={{
          color: colors.foreground,
          fontWeight: "600",
          fontSize: 16,
          marginTop: 12,
        }}
      >
        {selectedTagIds.length > 0
          ? "No products match these tags"
          : "No results found"}
      </Text>
      <Text
        style={{
          color: colors.muted,
          fontSize: 14,
          textAlign: "center",
          marginTop: 6,
        }}
      >
        {selectedTagIds.length > 0
          ? "Try a different tag combination"
          : "Try a different model number or brand name"}
      </Text>
    </View>
  );
}
