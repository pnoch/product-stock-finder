import { Platform, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useColors } from "@/hooks/use-colors";

// @react-native-community/datetimepicker has no web implementation (it renders
// null and logs "not supported"), which made the reminder/reschedule date
// pickers a dead end on the web export. On web, render a native <input
// type="date"> instead so the date can actually be changed.
export function CrossPlatformDatePicker({
  value,
  minimumDate,
  onChange,
}: {
  value: Date;
  minimumDate?: Date;
  onChange: (date: Date) => void;
}) {
  const colors = useColors();

  if (Platform.OS === "web") {
    const min = minimumDate
      ? `${minimumDate.getFullYear()}-${String(minimumDate.getMonth() + 1).padStart(2, "0")}-${String(minimumDate.getDate()).padStart(2, "0")}`
      : undefined;
    const val = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    return (
      <View style={{ marginBottom: 12 }}>
        <input
          type="date"
          value={val}
          min={min}
          onChange={(e) => {
            const next = e.target.value;
            if (!next) return;
            const [y, m, d] = next.split("-").map(Number);
            if (!y || !m || !d) return;
            onChange(new Date(y, m - 1, d));
          }}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surface,
            color: colors.foreground,
            fontSize: 15,
          }}
          aria-label="Reminder date"
        />
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
          Pick the date for this reminder.
        </Text>
      </View>
    );
  }

  return (
    <DateTimePicker
      value={value}
      mode="date"
      display={Platform.OS === "ios" ? "inline" : "default"}
      minimumDate={minimumDate}
      onChange={(_, selected) => {
        if (selected) onChange(selected);
      }}
    />
  );
}
