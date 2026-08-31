import { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { updateProductDetails } from "@/lib/storage";
import type { Product } from "@/lib/types";

interface Draft {
  name: string;
  modelNumber: string;
  brand: string;
  category: string;
  description: string;
}

function toDraft(product: Product): Draft {
  return {
    name: product.name,
    modelNumber: product.modelNumber,
    brand: product.brand ?? "",
    category: product.category ?? "",
    description: product.description ?? "",
  };
}

export function EditProductSheet({
  visible,
  onClose,
  product,
}: {
  visible: boolean;
  onClose: () => void;
  product: Product;
}) {
  const colors = useColors();
  const [draft, setDraft] = useState<Draft>(() => toDraft(product));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setDraft(toDraft(product));
  }, [visible, product]);

  const canSave =
    !saving && draft.name.trim().length > 0 && draft.modelNumber.trim().length > 0;
  const modelChanged =
    draft.modelNumber.trim() !== product.modelNumber.trim();

  const handleSave = async () => {
    if (!canSave) return;
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(true);
    try {
      await updateProductDetails(product.id, {
        name: draft.name,
        modelNumber: draft.modelNumber,
        brand: draft.brand,
        category: draft.category,
        description: draft.description,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

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
            maxHeight: "85%",
          }}
          accessibilityViewIsModal
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 20,
                fontWeight: "700",
                flex: 1,
              }}
            >
              Edit Product ✏️
            </Text>
            <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={{ padding: 4 }} accessibilityLabel="Close" accessibilityRole="button">
              <IconSymbol
                name="xmark.circle.fill"
                size={24}
                color={colors.muted}
              />
            </TouchableOpacity>
          </View>

          <ScrollView>
            <TextInput
              value={draft.name}
              onChangeText={(v) => setDraft({ ...draft, name: v })}
              placeholder="Product name"
              placeholderTextColor={colors.muted}
              style={fieldStyle(colors)}
            />
            <TextInput
              value={draft.modelNumber}
              onChangeText={(v) => setDraft({ ...draft, modelNumber: v })}
              placeholder="Model number"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={fieldStyle(colors)}
            />
            {modelChanged && (
              <Text
                style={{ color: colors.warning, fontSize: 11, marginTop: -8, marginBottom: 10 }}
              >
                Model changed — listings will re-match on next refresh.
              </Text>
            )}
            <TextInput
              value={draft.brand}
              onChangeText={(v) => setDraft({ ...draft, brand: v })}
              placeholder="Brand"
              placeholderTextColor={colors.muted}
              style={fieldStyle(colors)}
            />
            <TextInput
              value={draft.category}
              onChangeText={(v) => setDraft({ ...draft, category: v })}
              placeholder="Category"
              placeholderTextColor={colors.muted}
              style={fieldStyle(colors)}
            />
            <TextInput
              value={draft.description}
              onChangeText={(v) => setDraft({ ...draft, description: v })}
              placeholder="Description"
              placeholderTextColor={colors.muted}
              multiline
              style={{
                ...fieldStyle(colors),
                minHeight: 70,
                textAlignVertical: "top",
              }}
            />
            <TouchableOpacity activeOpacity={0.85}
              onPress={handleSave}
              disabled={!canSave}
              style={{
                backgroundColor: canSave ? colors.primary : colors.border,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
                marginBottom: 12,
                opacity: canSave ? 1 : 0.5,
              }}
              accessibilityLabel="Save changes"
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
            >
              <IconSymbol name="checkmark.circle.fill" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
                Save Changes
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function fieldStyle(colors: ReturnType<typeof useColors>) {
  return {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.foreground,
    fontSize: 14,
    marginBottom: 12,
  };
}
