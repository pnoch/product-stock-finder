import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { DeviceInfo } from "@/lib/devices";

interface RenameDeviceModalProps {
  target: DeviceInfo | null;
  label: string;
  setLabel: (label: string) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}

export function RenameDeviceModal({
  target,
  label,
  setLabel,
  saving,
  onSave,
  onClose,
}: RenameDeviceModalProps) {
  const colors = useColors();

  return (
    <Modal
      visible={!!target}
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
              fontSize: 20,
              fontWeight: "700",
              marginBottom: 4,
            }}
          >
            Rename Device ✏️
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            Give this device a friendly name
          </Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Living Room"
            placeholderTextColor={colors.muted}
            maxLength={64}
            autoFocus
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 16,
              paddingVertical: 12,
              color: colors.foreground,
              fontSize: 16,
              marginBottom: 20,
            }}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
              accessibilityLabel="Cancel"
              accessibilityRole="button"
            >
              <Text
                style={{
                  color: colors.foreground,
                  fontWeight: "600",
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSave}
              disabled={saving || !label.trim()}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                opacity: saving || !label.trim() ? 0.5 : 1,
              }}
              accessibilityLabel="Save device name"
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "600" }}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
