import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
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

  useEffect(() => {
    if (!visible) return;
    void getTagDefinitions()
      .then(setDefs)
      .catch(() => {});
    setEditingId(null);
    setEditName("");
    setError(null);
  }, [visible]);

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
    Alert.alert(
      "Delete Tag",
      `Delete "${tag.name}"? Products keep their other tags.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await deleteTag(tag.id);
                await refresh();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not delete tag",
                );
              }
            })();
          },
        },
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
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: "70%",
          }}
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
            {tags.map((tag) => (
              <View key={tag.id} style={{ marginBottom: 16 }}>
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
                    <TouchableOpacity
                      onPress={() => void handleRename(tag)}
                      style={{ padding: 8 }}
                    >
                      <IconSymbol
                        name="checkmark"
                        size={18}
                        color={colors.success}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setEditingId(null)}
                      style={{ padding: 8 }}
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
                    >
                      {tag.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingId(tag.id);
                        setEditName(tag.name);
                      }}
                      style={{ padding: 8 }}
                    >
                      <IconSymbol
                        name="pencil"
                        size={16}
                        color={colors.muted}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(tag)}
                      style={{ padding: 8 }}
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
                    <TouchableOpacity
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
                    />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity
            onPress={onClose}
            style={{ alignItems: "center", paddingVertical: 10 }}
          >
            <Text style={{ color: colors.muted, fontWeight: "600" }}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
