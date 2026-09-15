import { Text, View, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { addBackOrderReminder } from "@/lib/storage";
import { scheduleBackOrderReminder, ensureNotificationPermission } from "@/lib/notifications";
import { showAlert } from "@/lib/alert";
import { useToast } from "@/components/ui/toast";
import { useColors } from "@/hooks/use-colors";

export function ReminderSection({
  productId,
  distributorId,
  productName,
  distributorName,
  onRemind,
}: {
  productId: string;
  distributorId?: string;
  productName?: string;
  distributorName?: string;
  onRemind?: () => void;
}) {
  const colors = useColors();
  const { showToast } = useToast();
  if (!distributorId) {
    return (
      <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
        <Text style={{ color: colors.muted }}>No listings available for reminders</Text>
      </View>
    );
  }
  const onSet = async () => {
    if (onRemind) {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onRemind();
      return;
    }
    const granted = await ensureNotificationPermission();
    if (!granted) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Permission Denied", "Please enable notifications in your device settings to set reminders.");
      return;
    }
    try {
      const d = new Date(Date.now() + 7 * 86400000);
      const notifId = await scheduleBackOrderReminder(productName ?? "", distributorName ?? "", d, productId).catch(() => null);
      await addBackOrderReminder({ id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, productId, productName: productName ?? "", distributorId, distributorName: distributorName ?? "", reminderDate: d.toISOString(), notificationId: notifId ?? undefined, createdAt: new Date().toISOString(), reminderType: "date" });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`Reminder set for ${d.toLocaleDateString()}`, "success");
    } catch {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showAlert("Couldn't set reminder", "We couldn't save your reminder. Please try again.");
    }
  };
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>Back-order Reminder</Text>
      <TouchableOpacity activeOpacity={0.85} onPress={onSet} style={{ backgroundColor: colors.primary, borderRadius: 8, padding: 10, alignItems: "center" }} accessibilityLabel="Remind me" accessibilityRole="button"><Text style={{ color: "#fff", fontWeight: "600" }}>Remind Me</Text></TouchableOpacity>
    </View>
  );
}
