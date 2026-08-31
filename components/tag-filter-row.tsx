import { Text, TouchableOpacity, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { TagDefinition } from "@/lib/types";

interface Props {
  tagDefinitions: Record<string, TagDefinition>;
  selectedTagIds: string[];
  tagMatchMode: "any" | "all";
  counts: Record<string, number>;
  onToggleTag: (tagId: string) => void;
  onChangeMode: (mode: "any" | "all") => void;
  onClearAll: () => void;
  onManage?: () => void;
}

export function TagFilterRow({
  tagDefinitions,
  selectedTagIds,
  tagMatchMode,
  counts,
  onToggleTag,
  onChangeMode,
  onClearAll,
  onManage,
}: Props) {
  const colors = useColors();
  const tags = Object.values(tagDefinitions);
  if (tags.length === 0) return null;
  const hasSelection = selectedTagIds.length > 0;
  const showMode = selectedTagIds.length >= 2;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        marginBottom: 10,
        gap: 8,
      }}
    >
      <View
        style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 8, rowGap: 8 }}
      >
        {tags.map((tag) => {
          const active = selectedTagIds.includes(tag.id);
          return (
            <TouchableOpacity activeOpacity={0.85}
              key={tag.id}
              onPress={() => onToggleTag(tag.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 13,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: active ? colors.primary : colors.surface,
                borderWidth: active ? 1.5 : 1,
                borderColor: active ? colors.primary : colors.border,
                shadowColor: active ? colors.primary : "transparent",
                shadowOpacity: active ? 0.12 : 0,
                shadowRadius: active ? 6 : 0,
                shadowOffset: { width: 0, height: 1 },
                elevation: active ? 1 : 0,
              }}
              accessibilityLabel={`${active ? "Deselect" : "Select"} tag ${tag.name}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: active ? "#fff" : tag.color,
                  marginRight: 6,
                }}
              />
              <Text
                style={{
                  color: active ? "#fff" : colors.foreground,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {tag.name} · {counts[tag.id] ?? 0}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {showMode && (
        <View
          style={{
            flexDirection: "row",
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          {(["any", "all"] as const).map((mode) => {
            const active = tagMatchMode === mode;
            return (
              <TouchableOpacity activeOpacity={0.85}
                key={mode}
                onPress={() => onChangeMode(mode)}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  backgroundColor: active ? colors.primary : colors.surface,
                }}
                accessibilityLabel={`${mode === "any" ? "Any" : "All"} match mode`}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={{
                    color: active ? "#fff" : colors.foreground,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {mode === "any" ? "Any" : "All"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {hasSelection && (
        <TouchableOpacity activeOpacity={0.7} onPress={onClearAll} style={{ padding: 4 }} accessibilityLabel="Clear tag filter" accessibilityRole="button">
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>
            Clear
          </Text>
        </TouchableOpacity>
      )}
      {onManage && (
        <TouchableOpacity activeOpacity={0.7} onPress={onManage} style={{ padding: 4 }} accessibilityLabel="Manage tags" accessibilityRole="button">
          <IconSymbol name="slider.horizontal.3" size={18} color={colors.muted} />
        </TouchableOpacity>
      )}
    </View>
  );
}
