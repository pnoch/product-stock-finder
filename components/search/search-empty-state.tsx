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
    <View style={{ alignItems: "center", paddingTop: 48, paddingHorizontal: 16 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.primary + "14",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.primary + "22",
        }}
      >
        <IconSymbol name="magnifyingglass" size={30} color={colors.primary} />
      </View>
      <Text
        style={{
          color: colors.foreground,
          fontWeight: "600",
          fontSize: 16,
          marginTop: 14,
        }}
      >
        {selectedTagIds.length > 0
          ? "No products match these tags"
          : query.trim().length > 0
            ? `No results for "${query.trim().slice(0, 30)}"`
            : "No results found"}
      </Text>
      <Text
        style={{
          color: colors.muted,
          fontSize: 14,
          textAlign: "center",
          marginTop: 6,
          lineHeight: 20,
        }}
      >
        {selectedTagIds.length > 0
          ? "Try a different tag combination"
          : "Try a different model number or brand name"}
      </Text>
      {selectedTagIds.length === 0 && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            marginTop: 16,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <IconSymbol name="lightbulb.fill" size={16} color={colors.warning} />
          <Text style={{ color: colors.muted, fontSize: 12, flex: 1, textAlign: "center" }}>
            Try searching for RTX 4090, Pi 5, CRS326, or AirPods Max
          </Text>
        </View>
      )}
    </View>
  );
}
