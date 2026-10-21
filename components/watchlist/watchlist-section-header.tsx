import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { TagDefinition, WatchlistGroup } from "@/lib/types";

export function WatchlistSectionHeader({
  section,
  groupMode,
  tagDefinitions,
}: {
  section: { key: string; title: string; products: unknown[] };
  groupMode: WatchlistGroup;
  tagDefinitions: Record<string, TagDefinition>;
}) {
  const colors = useColors();
  if (groupMode === "off") return null;
  const tag =
    groupMode === "tag"
      ? tagDefinitions[section.key.replace("tag-", "")]
      : undefined;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 8,
        backgroundColor: colors.background,
      }}
    >
      {tag && (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: tag.color,
          }}
        />
      )}
      <Text
        style={{
          color: colors.muted,
          fontWeight: "600",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 0.8,
        }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {section.title}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        · {section.products.length}
      </Text>
    </View>
  );
}
