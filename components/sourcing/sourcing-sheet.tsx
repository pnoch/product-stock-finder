import { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { updateProductSourcing } from "@/lib/storage";
import { showAlert } from "@/lib/alert";

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

function parsePositive(raw: string): number | null {
  const n = Number.parseFloat(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function SourcingSheet({
  visible,
  productId,
  productName,
  quantity,
  targetSellPrice,
  currency,
  onClose,
  onSaved,
}: {
  visible: boolean;
  productId: string;
  productName: string;
  quantity?: number;
  targetSellPrice?: number;
  currency: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const colors = useColors();
  const [qty, setQty] = useState("");
  const [sell, setSell] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQty(quantity != null ? String(quantity) : "");
    setSell(targetSellPrice != null ? String(targetSellPrice) : "");
    setSaving(false);
  }, [visible, quantity, targetSellPrice]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateProductSourcing(productId, {
        quantity: parsePositive(qty),
        targetSellPrice: parsePositive(sell),
        sellCurrency: currency,
      });
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved?.();
      onClose();
    } catch {
      showAlert("Couldn't save", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateProductSourcing(productId, {
        quantity: null,
        targetSellPrice: null,
      });
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSaved?.();
      onClose();
    } catch {
      showAlert("Couldn't clear", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
              Sourcing
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onClose}
              style={{ padding: 4 }}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <IconSymbol name="xmark.circle.fill" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 12 }}>
            {productName}
          </Text>

          <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 6 }}>
            Quantity
          </Text>
          <TextInput
            value={qty}
            onChangeText={setQty}
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor={colors.muted}
            style={fieldStyle(colors)}
          />

          <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 6 }}>
            Target sell price ({currency})
          </Text>
          <TextInput
            value={sell}
            onChangeText={setSell}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.muted}
            style={fieldStyle(colors)}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save sourcing"
            onPress={handleSave}
            disabled={saving}
            style={{
              backgroundColor: colors.primary,
              opacity: saving ? 0.5 : 1,
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <IconSymbol name="checkmark.circle.fill" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>
              Save
            </Text>
          </Pressable>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleClear}
            disabled={saving}
            style={{ alignItems: "center", paddingVertical: 8, opacity: saving ? 0.5 : 1 }}
            accessibilityLabel="Clear sourcing"
            accessibilityRole="button"
          >
            <Text style={{ color: colors.muted, fontSize: 13 }}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
