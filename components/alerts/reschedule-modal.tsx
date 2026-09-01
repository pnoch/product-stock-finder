import {
  Platform,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BackOrderReminder } from "@/lib/types";
import { showAlert } from "@/lib/alert";

interface RescheduleModalProps {
  visible: boolean;
  target: BackOrderReminder | null;
  date: Date;
  showPicker: boolean;
  onDateChange: (date: Date) => void;
  onShowPicker: (show: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function RescheduleModal({
  visible,
  target,
  date,
  showPicker,
  onDateChange,
  onShowPicker,
  onConfirm,
  onCancel,
}: RescheduleModalProps) {
  const colors = useColors();

  const handleConfirm = () => {
    if (date.getTime() < startOfToday().getTime()) {
      showAlert("Invalid Date", "Please select today or a future date.");
      return;
    }
    onConfirm();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <Pressable
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
        onPress={onCancel}
        accessibilityViewIsModal
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: "90%",
          }}
          accessibilityViewIsModal
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 4 }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 20,
                fontWeight: "700",
                marginBottom: 4,
              }}
            >
              Reschedule Reminder 📅
            </Text>
            <Text
              style={{ color: colors.muted, fontSize: 14, marginBottom: 20 }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              Choose a new date for{" "}
              <Text style={{ fontWeight: "600", color: colors.foreground }}>
                {target?.distributorName}
              </Text>{" "}
              · {target?.productName}
            </Text>
            <TouchableOpacity activeOpacity={0.85}
              onPress={() => onShowPicker(true)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
              accessibilityLabel="Select date"
              accessibilityRole="button"
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <IconSymbol name="calendar" size={20} color={colors.primary} />
                <Text
                  style={{
                    color: colors.foreground,
                    fontSize: 17,
                    fontWeight: "600",
                  }}
                >
                  {date.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </TouchableOpacity>
            {showPicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                minimumDate={startOfToday()}
                onChange={(_, selected) => {
                  onShowPicker(Platform.OS === "ios");
                  if (selected) onDateChange(selected);
                }}
              />
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity activeOpacity={0.85}
                onPress={onCancel}
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                accessibilityLabel="Dismiss"
                accessibilityRole="button"
                accessibilityHint="Dismisses the reschedule picker"
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.85}
                onPress={handleConfirm}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
                accessibilityLabel="Reschedule reminder"
                accessibilityRole="button"
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  Reschedule
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
