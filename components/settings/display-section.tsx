import { useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { CURRENCIES } from "@shared/currency";
import { getCountry } from "@shared/countries";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { CountryPicker } from "@/components/ui/country-picker";
import { PillPicker } from "@/components/settings/pill-picker";
import { SettingRow } from "@/components/settings/setting-row";
import { SectionHeader } from "@/components/settings/section-header";
import type { AppSettings } from "@/lib/types";

export function DisplaySection({
  settings,
  updateSetting,
}: {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => Promise<void>;
}) {
  const colors = useColors();
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);

  return (
    <>
      <SectionHeader title="Display" />
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          marginHorizontal: 16,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        <PillPicker
          icon="dollarsign.circle.fill"
          label="Display Currency"
          options={CURRENCIES}
          value={settings.displayCurrency}
          onSelect={(currency) => updateSetting("displayCurrency", currency)}
        />
      </View>

      <SectionHeader title="Ship to" />
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          marginHorizontal: 16,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        <Pressable
          onPress={() => setCountryPickerVisible(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
          accessibilityLabel="Choose shipping country"
          accessibilityRole="button"
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: colors.primary + "22",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <IconSymbol name="location.fill" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "600",
                fontSize: 15,
              }}
            >
              Ship to
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
              {getCountry(settings.shipToCountry ?? "")?.name ?? "Choose country"}
            </Text>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        </Pressable>
        <SettingRow
          icon="dollarsign.circle.fill"
          label="I'm tax-exempt (VAT/EORI)"
          description="Omit tax and duty from landed-cost totals."
          right={
            <Switch
              value={!!settings.taxExempt}
              onValueChange={(value) => void updateSetting("taxExempt", value)}
              trackColor={{ false: colors.border, true: colors.primary + "88" }}
              thumbColor={settings.taxExempt ? colors.primary : colors.muted}
              accessibilityLabel="I'm tax-exempt"
              accessibilityRole="switch"
            />
          }
        />
        <SettingRow
          icon="cart.fill"
          label="Include import estimate"
          description="Add the destination duty/VAT estimate to the displayed total."
          right={
            <Switch
              value={!!settings.includeImportEstimate}
              onValueChange={(value) =>
                void updateSetting("includeImportEstimate", value)
              }
              trackColor={{ false: colors.border, true: colors.primary + "88" }}
              thumbColor={
                settings.includeImportEstimate ? colors.primary : colors.muted
              }
              accessibilityLabel="Include import estimate"
              accessibilityRole="switch"
            />
          }
        />
      </View>

      <CountryPicker
        visible={countryPickerVisible}
        value={settings.shipToCountry}
        onSelect={(code) => {
          void updateSetting("shipToCountry", code);
          setCountryPickerVisible(false);
        }}
        onClose={() => setCountryPickerVisible(false)}
      />
    </>
  );
}
