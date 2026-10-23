import { Switch, Text, TouchableOpacity, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getCountry } from "@shared/countries";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function ShippingOptionsCard({
  colors,
  destination,
  taxExempt,
  onToggleTaxExempt,
  includeImportEstimate,
  onToggleImportEstimate,
  onOpenPicker,
}: {
  colors: Colors;
  destination: { countryCode: string } | null;
  taxExempt: boolean;
  onToggleTaxExempt: (value: boolean) => void;
  includeImportEstimate: boolean;
  onToggleImportEstimate: (value: boolean) => void;
  onOpenPicker: () => void;
}) {
  const selectedCountry = destination ? getCountry(destination.countryCode) : undefined;
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onOpenPicker}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 44,
        }}
        accessibilityLabel="Choose shipping country"
        accessibilityRole="button"
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <IconSymbol name="globe" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", letterSpacing: 0.5 }}>
              SHIP TO
            </Text>
            <Text
              style={{
                color: selectedCountry ? colors.foreground : colors.muted,
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              {selectedCountry ? selectedCountry.name : "Choose country"}
            </Text>
          </View>
        </View>
        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
      </TouchableOpacity>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 8,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Text style={{ color: colors.foreground, fontSize: 13, flex: 1, marginRight: 12 }}>
          Tax-exempt (VAT/EORI)
        </Text>
        <Switch
          value={taxExempt}
          onValueChange={onToggleTaxExempt}
          trackColor={{ false: colors.border, true: colors.primary + "88" }}
          thumbColor={taxExempt ? colors.primary : colors.muted}
          accessibilityLabel="Tax-exempt"
          accessibilityRole="switch"
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 4,
        }}
      >
        <Text style={{ color: colors.foreground, fontSize: 13, flex: 1, marginRight: 12 }}>
          Include import estimate
        </Text>
        <Switch
          value={includeImportEstimate}
          onValueChange={onToggleImportEstimate}
          trackColor={{ false: colors.border, true: colors.primary + "88" }}
          thumbColor={includeImportEstimate ? colors.primary : colors.muted}
          accessibilityLabel="Include import estimate"
          accessibilityRole="switch"
        />
      </View>
    </View>
  );
}
