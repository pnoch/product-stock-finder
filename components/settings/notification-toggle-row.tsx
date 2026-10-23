import { Switch } from "react-native";
import { SettingRow } from "@/components/settings/setting-row";
import type { IconSymbolName } from "@/components/ui/icon-symbol";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function NotificationToggleRow({
  colors,
  icon,
  label,
  description,
  value,
  onValueChange,
  accessibilityLabel,
}: {
  colors: Colors;
  icon: IconSymbolName;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
}) {
  return (
    <SettingRow
      icon={icon}
      label={label}
      description={description}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: colors.primary + "88" }}
          thumbColor={value ? colors.primary : colors.muted}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="switch"
        />
      }
    />
  );
}
