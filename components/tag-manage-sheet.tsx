import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  findNodeHandle,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import {
  deleteTag,
  getTagDefinitions,
  renameTag,
  setTagColor,
} from "@/lib/storage";
import { TAG_PALETTE } from "@/lib/tags";
import { TagDefinition } from "@/lib/types";

interface Props {
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function TagManageSheet({ visible, onClose, onChanged }: Props) {
  const colors = useColors();
  const [defs, setDefs] = useState<Record<string, TagDefinition>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const firstRowRef = useRef<View | null>(null);

  useEffect(() => {
    if (!visible) return;
    void getTagDefinitions()
      .then(setDefs)
      .catch(() => {});
    setEditingId(null);
    setEditName("");
    setError(null);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      const node = firstRowRef.current ? findNodeHandle(firstRowRef.current) : null;
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 300);
    return () => clearTimeout(t);
  }, [visible, defs]);

  const refresh = useCallback(async () => {
    setDefs(await getTagDefinitions());
    onChanged();
  }, [onChanged]);

  const handleRename = async (tag: TagDefinition) => {
    if (!editName.trim()) return;
    try {
      await renameTag(tag.id, editName);
      setEditingId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rename tag");
    }
  };

  const handleDelete = (tag: TagDefinition) => {
    const doDelete = () => {
      void (async () => {
        try {
          await deleteTag(tag.id);
          await refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not delete tag");
        }
      })();
    };
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(
          `Delete "${tag.name}"? Products keep their other tags.`,
        )
      ) {
        doDelete();
      }
      return;
    }
    Alert.alert(
      "Delete Tag",
      `Delete "${tag.name}"? Products keep their other tags.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ],
    );
  };

  const handleRecolor = async (tag: TagDefinition, color: string) => {
    try {
      await setTagColor(tag.id, color);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not recolor tag");
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
              marginBottom: 16,
            }}
          >
            Manage Tags
          </Text>
          {error && (
            <Text
              style={{ color: colors.error, fontSize: 12, marginBottom: 8 }}
            >
              {error}
            </Text>
          )}
          {tags.length === 0 && (
            <Text
              style={{ color: colors.muted, fontSize: 14, marginBottom: 12 }}
            >
              No tags yet. Tag a product from the watchlist to create one.
            </Text>
          )}
          <ScrollView style={{ maxHeight: 360 }}>
            {tags.map((tag, idx) => (
              <View key={tag.id} style={{ marginBottom: 16 }} ref={idx === 0 ? (el: unknown) => { firstRowRef.current = el as View; } : undefined}>
                {editingId === tag.id ? (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <TextInput
                      value={editName}
                      onChangeText={setEditName}
                      autoFocus
                      maxLength={24}
                      style={{
                        flex: 1,
                        backgroundColor: colors.surface,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        color: colors.foreground,
                        fontSize: 15,
                      }}
                    />
                    <TouchableOpacity activeOpacity={0.7}
                      onPress={() => void handleRename(tag)}
                      style={{ padding: 8 }}
                      accessibilityLabel="Confirm rename"
                      accessibilityRole="button"
                    >
                      <IconSymbol
                        name="checkmark"
                        size={18}
                        color={colors.success}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7}
                      onPress={() => setEditingId(null)}
                      style={{ padding: 8 }}
                      accessibilityLabel="Cancel rename"
                      accessibilityRole="button"
                    >
                      <IconSymbol name="xmark" size={18} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: tag.color,
                        marginRight: 8,
                      }}
                    />
                    <Text
                      style={{
                        flex: 1,
                        color: colors.foreground,
                        fontSize: 15,
                      }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {tag.name}
                    </Text>
                    <TouchableOpacity activeOpacity={0.7}
                      onPress={() => {
                        setEditingId(tag.id);
                        setEditName(tag.name);
                      }}
                      style={{ padding: 8 }}
                      accessibilityLabel={`Rename tag ${tag.name}`}
                      accessibilityRole="button"
                    >
                      <IconSymbol
                        name="pencil"
                        size={16}
                        color={colors.muted}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7}
                      onPress={() => handleDelete(tag)}
                      style={{ padding: 8 }}
                      accessibilityLabel={`Delete tag ${tag.name}`}
                      accessibilityRole="button"
                      accessibilityHint="Double tap to delete"
                    >
                      <IconSymbol
                        name="trash.fill"
                        size={16}
                        color={colors.error}
                      />
                    </TouchableOpacity>
                  </View>
                )}
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  {TAG_PALETTE.map((color) => (
                    <TouchableOpacity activeOpacity={0.7}
                      key={color}
                      onPress={() => void handleRecolor(tag, color)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: color,
                        borderWidth: 2,
                        borderColor:
                          tag.color === color
                            ? colors.foreground
                            : "transparent",
                      }}
                      accessibilityLabel={`Set color to ${color}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: tag.color === color }}
                    />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity activeOpacity={0.7}
            onPress={onClose}
            style={{ alignItems: "center", paddingVertical: 10 }}
            accessibilityLabel="Close"
            accessibilityRole="button"
            accessibilityHint="Dismisses the tag manager"
          >
            <Text style={{ color: colors.foreground, fontWeight: "600" }}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
