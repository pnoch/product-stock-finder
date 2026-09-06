import {
  Text,
  View,
  TouchableOpacity,
  Modal,
  Platform,
  ScrollView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColors } from "@/hooks/use-colors";
import { DistributorListing } from "@/lib/types";
import { getDistributorById } from "@shared/distributors";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface ReminderDatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  reminderListing: DistributorListing | null;
  reminderDate: Date;
  showDatePicker: boolean;
  setShowDatePicker: (show: boolean) => void;
  setReminderDate: (date: Date) => void;
  onSetReminder: () => void;
  productName: string;
}

export function ReminderDatePickerModal({
  visible,
  onClose,
  reminderListing,
  reminderDate,
  showDatePicker,
  setShowDatePicker,
  setReminderDate,
  onSetReminder,
  productName,
}: ReminderDatePickerModalProps) {
  const colors = useColors();

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
        <ScrollView
          style={{ maxHeight: "85%" }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
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
              fontSize: 20,
              fontWeight: "700",
              marginBottom: 4,
            }}
          >
            Set Reminder 📅
          </Text>
          <Text
            style={{ color: colors.muted, fontSize: 14, marginBottom: 20 }}
          >
            Pick a date to be reminded to check{" "}
            <Text style={{ fontWeight: "600", color: colors.foreground }}>
              {reminderListing
                ? (getDistributorById(reminderListing.distributorId)?.name ??
                  reminderListing.distributorId)
                : ""}
            </Text>{" "}
            for {productName}.
          </Text>
          <TouchableOpacity activeOpacity={0.7}
            onPress={() => setShowDatePicker(true)}
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
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <IconSymbol
                name="calendar"
                size={20}
                color={colors.primary}
              />
              <Text
                style={{
                  color: colors.foreground,
                  fontSize: 17,
                  fontWeight: "600",
                }}
              >
                {reminderDate.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
            <IconSymbol
              name="chevron.right"
              size={16}
              color={colors.muted}
            />
          </TouchableOpacity>
          {showDatePicker && (
            <ScrollView style={{ maxHeight: 380, marginBottom: 12 }} showsVerticalScrollIndicator={false}>
              <DateTimePicker
                value={reminderDate}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                minimumDate={new Date(Date.now() + 86400000)}
                onChange={(_, selected) => {
                  setShowDatePicker(Platform.OS === "ios");
                  if (selected) setReminderDate(selected);
                }}
              />
            </ScrollView>
          )}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity activeOpacity={0.85}
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
              accessibilityLabel="Dismiss"
              accessibilityRole="button"
              accessibilityHint="Dismisses the reminder picker"
            >
              <Text
                style={{ color: colors.foreground, fontWeight: "600" }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85}
              onPress={onSetReminder}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
              }}
              accessibilityLabel="Set reminder"
              accessibilityRole="button"
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                Set Reminder
              </Text>
            </TouchableOpacity>
          </View>
          </View>
          </ScrollView>
        </View>
    </Modal>
  );
}
