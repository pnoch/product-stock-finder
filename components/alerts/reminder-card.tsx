import { Platform, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { BackOrderReminder } from "@/lib/types";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

type ReminderCardProps = {
  reminder: BackOrderReminder;
  onReschedule: (reminder: BackOrderReminder) => void;
  onDelete: (reminder: BackOrderReminder) => void;
};

export function ReminderCard({
  reminder,
  onReschedule,
  onDelete,
}: ReminderCardProps) {
  const colors = useColors();
  const reminderDate = new Date(reminder.reminderDate);
  const isPast = reminderDate < new Date();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: isPast ? colors.warning + "44" : colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text
            style={{
              color: colors.foreground,
              fontWeight: "600",
              fontSize: 14,
            }}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {reminder.productName}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 5,
              gap: 5,
            }}
          >
            <IconSymbol name="globe" size={13} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {reminder.distributorName}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 4,
              gap: 5,
            }}
          >
            <IconSymbol
              name="calendar"
              size={13}
              color={isPast ? colors.warning : colors.primary}
            />
            <Text
              style={{
                color: isPast ? colors.warning : colors.primary,
                fontSize: 13,
                fontWeight: "500",
              }}
            >
              {isPast ? "Was due " : "Remind on "}
              {reminderDate.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 8 }}>
          {isPast && (
            <View
              style={{
                backgroundColor: colors.warning + "22",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text
                style={{
                  color: colors.warning,
                  fontSize: 11,
                  fontWeight: "600",
                }}
              >
                Past Due
              </Text>
            </View>
          )}
          <TouchableOpacity activeOpacity={0.7}
            onPress={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onReschedule(reminder);
            }}
            style={{ padding: 4 }}
            accessibilityLabel={`Reschedule reminder for ${reminder.productName}`}
            accessibilityRole="button"
          >
            <IconSymbol name="pencil" size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7}
            onPress={() => onDelete(reminder)}
            style={{ padding: 4 }}
            accessibilityLabel={`Delete reminder for ${reminder.productName}`}
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
      </View>
    </View>
  );
}
