import { Text, View, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { addBackOrderReminder } from "@/lib/storage";
import { scheduleBackOrderReminder } from "@/lib/notifications";
import { showAlert } from "@/lib/alert";
import { useToast } from "@/components/ui/toast";
import { useColors } from "@/hooks/use-colors";

export function ReminderSection({ productId, distributorId, productName, distributorName }: { productId: string; distributorId?: string; productName?: string; distributorName?: string }) {
  const colors = useColors();
  const { showToast } = useToast();
  if (!distributorId) {
    return <Text style={{ color: colors.muted, padding: 16 }}>No listings available for reminders</Text>;
  }
  const onSet = async () => {
    try {
      const d = new Date(Date.now() + 7 * 86400000);
      const notifId = await scheduleBackOrderReminder(productId, distributorId, d).catch(() => null);
      await addBackOrderReminder({ id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, productId, productName: productName ?? "", distributorId, distributorName: distributorName ?? "", reminderDate: d.toISOString(), notificationId: notifId ?? undefined, createdAt: new Date().toISOString() });
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
