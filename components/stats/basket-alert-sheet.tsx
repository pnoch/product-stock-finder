import { memo, useEffect, useState, useCallback, useMemo } from "react";
import {
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/use-colors";

export const BasketAlertSheet = memo(function BasketAlertSheet({
  visible,
  onClose,
  currentThreshold,
  onSave,
  displayCurrency,
}: {
  visible: boolean;
  onClose: () => void;
  currentThreshold: number | null;
  onSave: (threshold: number | null) => void;
  displayCurrency?: string;
}) {
  const colors = useColors();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (visible) setValue(currentThreshold ? String(currentThreshold) : "");
  }, [visible, currentThreshold]);

  const numeric = useMemo(() => parseFloat(value), [value]);
  const valid = useMemo(() => !isNaN(numeric) && numeric > 0, [numeric]);
  const handleDisable = useCallback(() => {
    onSave(null);
    onClose();
  }, [onSave, onClose]);
  const handleEnable = useCallback(() => {
    if (!valid) return;
    onSave(numeric);
    onClose();
  }, [valid, numeric, onSave, onClose]);

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
          }}
          accessibilityViewIsModal
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
            ({displayCurrency ?? "USD"}). Fires once, then turns off.
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
              <TouchableOpacity activeOpacity={0.7}
                onPress={handleDisable}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                accessibilityLabel="Disable basket alert"
                accessibilityRole="button"
              >
                <Text style={{ color: colors.muted, fontWeight: "600" }}>
                  Disable
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity activeOpacity={0.85}
              onPress={handleEnable}
              disabled={!valid}
              style={{
                flex: currentThreshold != null ? 1 : 2,
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: valid ? colors.primary : colors.border,
                opacity: valid ? 1 : 0.5,
              }}
              accessibilityLabel="Enable basket alert"
              accessibilityRole="button"
              accessibilityState={{ disabled: !valid }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>Enable</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});
BasketAlertSheet.displayName = "BasketAlertSheet";
