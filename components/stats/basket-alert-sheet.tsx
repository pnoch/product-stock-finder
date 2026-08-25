import { useEffect, useState } from "react";
import {
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/use-colors";

export function BasketAlertSheet({
  visible,
  onClose,
  currentThreshold,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  currentThreshold: number | null;
  onSave: (threshold: number | null) => void;
}) {
  const colors = useColors();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (visible) setValue(currentThreshold ? String(currentThreshold) : "");
  }, [visible, currentThreshold]);

  const numeric = parseFloat(value);
  const valid = !isNaN(numeric) && numeric > 0;

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
          }}
        >
          <Text
            style={{
              color: colors.foreground,
              fontSize: 18,
              fontWeight: "700",
              marginBottom: 6,
            }}
          >
            🧺 Basket Value Alert
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 14 }}>
            Notify me when the total watchlist value drops below this amount
            (USD). Fires once, then turns off.
          </Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="e.g. 500"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
            autoFocus
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 14,
              paddingVertical: 10,
              color: colors.foreground,
              fontSize: 15,
              marginBottom: 14,
            }}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            {currentThreshold != null && (
              <TouchableOpacity
                onPress={() => {
                  onSave(null);
                  onClose();
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.muted, fontWeight: "600" }}>
                  Disable
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                if (!valid) return;
                onSave(numeric);
                onClose();
              }}
              disabled={!valid}
              style={{
                flex: currentThreshold != null ? 1 : 2,
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: valid ? colors.primary : colors.border,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>Enable</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
