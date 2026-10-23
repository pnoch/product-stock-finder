import { Text, View } from "react-native";
import { getTagById } from "@/lib/tags";
import type { TagDefinition } from "@/lib/types";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function ProductCardTags({
  colors,
  validTags,
  tagDefinitions,
}: {
  colors: Colors;
  validTags: string[];
  tagDefinitions: Record<string, TagDefinition>;
}) {
  if (validTags.length === 0) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 10,
      }}
    >
      {validTags.slice(0, 3).map((id) => {
        const tag = getTagById(tagDefinitions, id);
        if (!tag) return null;
        return (
          <View
            key={id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.surface,
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderWidth: 1,
              borderColor: colors.border,
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 3.5,
                backgroundColor: tag.color,
                marginRight: 5,
              }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1} ellipsizeMode="tail">
                {tag.name}
              </Text>
            </View>
          </View>
        );
      })}
      {validTags.length > 3 && (
        <Text style={{ color: colors.muted, fontSize: 11, alignSelf: "center" }}>
          +{validTags.length - 3}
        </Text>
      )}
    </View>
  );
}
