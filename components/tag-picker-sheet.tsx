import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Animated,
  Easing,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { createTag, getTagDefinitions, setProductTags } from "@/lib/storage";
import { nextTagColor } from "@/lib/tags";
import { Product, TagDefinition } from "@/lib/types";

interface Props {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onChanged: () => void;
  onApply?: (tagIds: string[]) => void;
}

export function TagPickerSheet({
  visible,
  product,
  onClose,
  onChanged,
  onApply,
}: Props) {
  const colors = useColors();
  const [defs, setDefs] = useState<Record<string, TagDefinition>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const selectedRef = useRef<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const firstTagRef = useRef<View | null>(null);
  const newTagInputRef = useRef<TextInput | null>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !product) return;
    void getTagDefinitions()
      .then(setDefs)
      .catch(() => {});
    const initial = product.tags ?? [];
    selectedRef.current = initial;
    setSelected(initial);
    setNewTagName("");
    setError(null);
  }, [visible, product]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, tension: 68, friction: 11 }),
      ]).start();
    } else {
      sheetAnim.setValue(0);
      backdropAnim.setValue(0);
    }
  }, [visible, sheetAnim, backdropAnim]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      const target = firstTagRef.current
        ? findNodeHandle(firstTagRef.current)
        : null;
      if (target) AccessibilityInfo.setAccessibilityFocus(target);
      else newTagInputRef.current?.focus();
    }, 320);
    return () => clearTimeout(t);
  }, [visible, defs]);

  const updateSelected = (next: string[]) => {
    selectedRef.current = next;
    setSelected(next);
  };

  if (!product) return null;

  const toggleTag = async (tagId: string) => {
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const cur = selectedRef.current;
    const next = cur.includes(tagId)
      ? cur.filter((id) => id !== tagId)
      : [...cur, tagId];
    updateSelected(next);
    if (onApply) return;
    await setProductTags(product.id, next);
    onChanged();
  };

  const handleCreate = async () => {
    const name = newTagName.trim();
    if (!name) return;
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const current = await getTagDefinitions();
      const tag = await createTag(name, nextTagColor(current));
      const next = [...selectedRef.current, tag.id];
      updateSelected(next);
      setDefs({ ...current, [tag.id]: tag });
      setNewTagName("");
      setError(null);
      if (onApply) {
        onChanged();
        return;
      }
      await setProductTags(product.id, next);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create tag");
    }
  };

  const tags = Object.values(defs);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
          opacity: backdropAnim,
        }}
        accessibilityViewIsModal
      >
        <Animated.View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: "70%",
            opacity: sheetAnim,
            transform: [
              {
                translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [48, 0] }),
              },
              {
                scale: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }),
              },
            ],
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
            Tags
          </Text>
          <Text
            style={{ color: colors.muted, fontSize: 14, marginBottom: 16 }}
            numberOfLines={1}
          >
            {product.name}
          </Text>
          <ScrollView style={{ maxHeight: 300 }}>
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
                  onPress={() => void toggleTag(tag.id)}
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
                  <Text style={{ color: colors.foreground, fontSize: 15, flexShrink: 1, flexWrap: "wrap" }} numberOfLines={1} ellipsizeMode="tail">
                    {tag.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={{ marginTop: 12 }}>
            <TextInput
              ref={newTagInputRef}
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
            <TouchableOpacity activeOpacity={0.85}
              onPress={() => void handleCreate()}
              disabled={!newTagName.trim()}
              style={{
                marginTop: 8,
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: "center",
                opacity: newTagName.trim() ? 1 : 0.5,
              }}
              accessibilityLabel="Create tag"
              accessibilityRole="button"
              accessibilityState={{ disabled: !newTagName.trim() }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                Create tag
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity activeOpacity={0.7}
            onPress={() => {
              if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (onApply) onApply(selectedRef.current);
              onClose();
            }}
            style={{ marginTop: 16, alignItems: "center", paddingVertical: 10 }}
            accessibilityLabel="Close"
            accessibilityRole="button"
            accessibilityHint="Dismisses the tag picker"
          >
            <Text style={{ color: colors.foreground, fontWeight: "600" }}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
