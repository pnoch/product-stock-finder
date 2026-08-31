import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { addTagsToProducts, createTag, getTagDefinitions } from "@/lib/storage";
import { nextTagColor } from "@/lib/tags";
import { TagDefinition } from "@/lib/types";

interface Props {
  visible: boolean;
  productIds: string[];
  tagDefinitions: Record<string, TagDefinition>;
  onClose: () => void;
  onChanged: () => void;
}

export function BulkTagSheet({
  visible,
  productIds,
  tagDefinitions,
  onClose,
  onChanged,
}: Props) {
  const colors = useColors();
  const [defs, setDefs] = useState<Record<string, TagDefinition>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const firstTagRef = useRef<View | null>(null);

  useEffect(() => {
    if (!visible) return;
    void getTagDefinitions()
      .then(setDefs)
      .catch(() => {});
    setSelected([]);
    setNewTagName("");
    setError(null);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      const node = firstTagRef.current ? findNodeHandle(firstTagRef.current) : null;
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 300);
    return () => clearTimeout(t);
  }, [visible, defs]);

  const toggleTag = (tagId: string) => {
    setSelected((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  const handleApply = async () => {
    if (selected.length === 0 || productIds.length === 0) return;
    try {
      await addTagsToProducts(productIds, selected);
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not apply tags");
    }
  };

  const handleCreate = async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const current = await getTagDefinitions();
      const tag = await createTag(name, nextTagColor(current));
      setDefs({ ...current, [tag.id]: tag });
      setSelected((prev) => [...prev, tag.id]);
      setNewTagName("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create tag");
    }
  };

  const tags = Object.values(defs);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
        accessibilityViewIsModal
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: "70%",
          }}
          accessibilityViewIsModal
        >
          <Text
            style={{
              color: colors.foreground,
              fontSize: 20,
              fontWeight: "700",
              marginBottom: 4,
            }}
          >
            Add Tags
          </Text>
          <Text
            style={{ color: colors.muted, fontSize: 14, marginBottom: 16 }}
          >
            Apply to {productIds.length} product
            {productIds.length !== 1 ? "s" : ""}
          </Text>
          <ScrollView style={{ maxHeight: 260 }}>
            {tags.length === 0 && (
              <Text
                style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}
              >
                No tags yet — create one below.
              </Text>
            )}
            {tags.map((tag, idx) => {
              const active = selected.includes(tag.id);
              return (
                <TouchableOpacity activeOpacity={0.7}
                  key={tag.id}
                  ref={idx === 0 ? (el: unknown) => { firstTagRef.current = el as View; } : undefined}
                  onPress={() => toggleTag(tag.id)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 10,
                  }}
                  accessibilityLabel={`${active ? "Deselect" : "Select"} tag ${tag.name}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 5,
                      borderWidth: 2,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: active ? colors.primary : colors.surface,
                      marginRight: 10,
                    }}
                  >
                    {active && (
                      <IconSymbol name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: tag.color,
                      marginRight: 8,
                    }}
                  />
                  <Text style={{ color: colors.foreground, fontSize: 15, flexShrink: 1 }} numberOfLines={1} ellipsizeMode="tail">
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={{ marginTop: 12 }}>
            <TextInput
              value={newTagName}
              onChangeText={setNewTagName}
              placeholder="New tag name"
              placeholderTextColor={colors.muted}
              maxLength={24}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 16,
                paddingVertical: 12,
                color: colors.foreground,
                fontSize: 15,
              }}
            />
            {error && (
              <Text style={{ color: colors.error, fontSize: 12, marginTop: 6 }}>
                {error}
              </Text>
            )}
            <TouchableOpacity activeOpacity={0.7}
              onPress={() => void handleCreate()}
              disabled={!newTagName.trim()}
              style={{
                marginTop: 8,
                backgroundColor: colors.surface,
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
                opacity: newTagName.trim() ? 1 : 0.5,
              }}
              accessibilityLabel="Create tag"
              accessibilityRole="button"
              accessibilityState={{ disabled: !newTagName.trim() }}
            >
              <Text style={{ color: colors.foreground, fontWeight: "600" }}>
                Create tag
              </Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85}
              onPress={() => void handleApply()}
              disabled={selected.length === 0}
              style={{
                marginTop: 8,
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: "center",
                opacity: selected.length === 0 ? 0.5 : 1,
              }}
              accessibilityLabel={`Add ${selected.length > 0 ? `${selected.length} tag${selected.length !== 1 ? "s" : ""} ` : ""}to selected`}
              accessibilityRole="button"
              accessibilityState={{ disabled: selected.length === 0 }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                Add {selected.length > 0 ? `${selected.length} tag${selected.length !== 1 ? "s" : ""} ` : ""}to selected
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity activeOpacity={0.7}
            onPress={onClose}
            style={{ marginTop: 16, alignItems: "center", paddingVertical: 10 }}
            accessibilityLabel="Dismiss"
            accessibilityRole="button"
            accessibilityHint="Dismisses the bulk tag sheet"
          >
            <Text style={{ color: colors.foreground, fontWeight: "600" }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}