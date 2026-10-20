import { View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { PillPicker } from "@/components/settings/pill-picker";
import { RadioPicker } from "@/components/settings/radio-picker";
import { SectionHeader } from "@/components/settings/section-header";
import type { AppSettings } from "@/lib/types";

export function MonitoringSection({
  settings,
  updateSetting,
  regions,
  intervals,
}: {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => Promise<void>;
  regions: string[];
  intervals: { value: string; label: string }[];
}) {
  const colors = useColors();
  const cardStyle = {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden" as const,
  };

  return (
    <>
      <SectionHeader title="Shipping Region" />
      <View style={cardStyle}>
        <PillPicker
          icon="globe"
          label="Shipping Region"
          options={regions}
          value={settings.shippingRegion ?? "Asia-Pacific"}
          onSelect={(region) => updateSetting("shippingRegion", region)}
        />
      </View>

      <SectionHeader title="Check Interval" />
      <View style={cardStyle}>
        <RadioPicker
          icon="clock.fill"
          label="Check Interval"
          options={intervals}
          value={settings.checkInterval}
          onSelect={(value) =>
            updateSetting(
              "checkInterval",
              value as AppSettings["checkInterval"],
            )
          }
        />
      </View>
    </>
  );
}
