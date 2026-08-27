import { useState } from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { addBackOrderReminder } from "@/lib/storage";
import { scheduleBackOrderReminder } from "@/lib/notifications";
import { showAlert } from "@/lib/alert";
import { useColors } from "@/hooks/use-colors";

export function ReminderSection({ productId, distributorId }: { productId: string; distributorId: string }) {
  const colors = useColors();
  const [date, setDate] = useState<Date | null>(null);
  const onSet = async () => {
    const d = date ?? new Date(Date.now() + 7 * 86400000);
    const notifId = await scheduleBackOrderReminder(productId, distributorId, d).catch(() => null);
    await addBackOrderReminder({ id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, productId, distributorId, reminderDate: d.toISOString(), notificationId: notifId ?? undefined, createdAt: new Date().toISOString() } as never);
    showAlert("Reminder Set", `You'll be reminded on ${d.toLocaleDateString()}.`);
  };
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ color: colors.foreground, fontWeight: "600", marginBottom: 8 }}>Back-order Reminder</Text>
      <TouchableOpacity onPress={onSet} style={{ backgroundColor: colors.primary, borderRadius: 8, padding: 10, alignItems: "center" }}><Text style={{ color: "#fff", fontWeight: "600" }}>Remind Me</Text></TouchableOpacity>
    </View>
  );
}
