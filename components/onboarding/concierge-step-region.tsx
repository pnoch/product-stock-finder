import { Pressable, Switch, Text, TouchableOpacity, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getCountry } from "@shared/countries";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function ConciergeStepRegion({
  colors,
  country,
  onOpenPicker,
  taxExempt,
  onTaxExemptChange,
  onBack,
  onNext,
}: {
  colors: Colors;
  country: string | null;
  onOpenPicker: () => void;
  taxExempt: boolean;
  onTaxExemptChange: (value: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 32 }}>
      <Text
        accessibilityRole="header"
        style={{
          color: colors.foreground,
          fontSize: 28,
          fontWeight: "700",
          textAlign: "center",
          marginTop: 8,
        }}
      >
        Where do you ship to?
      </Text>
      <Text
        style={{
          color: colors.muted,
          fontSize: 15,
          textAlign: "center",
          marginTop: 10,
          lineHeight: 22,
        }}
      >
        We use this to estimate landed cost and show prices in your local
        currency.
      </Text>

      <Pressable
        onPress={onOpenPicker}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          paddingVertical: 15,
          paddingHorizontal: 16,
          marginTop: 28,
        }}
        accessibilityLabel="Choose shipping country"
        accessibilityRole="button"
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <IconSymbol name="globe" size={20} color={colors.primary} />
          <Text
            style={{
              color: country ? colors.foreground : colors.muted,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {country ? (getCountry(country)?.name ?? "Choose country") : "Choose country"}
          </Text>
        </View>
        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
      </Pressable>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 16,
          paddingHorizontal: 4,
        }}
      >
        <Text
          style={{
            color: colors.foreground,
            fontSize: 15,
            flex: 1,
            marginRight: 12,
          }}
        >
          I&apos;m tax-exempt (VAT/EORI)
        </Text>
        <Switch
          value={taxExempt}
          onValueChange={onTaxExemptChange}
          trackColor={{ false: colors.border, true: colors.primary + "88" }}
          thumbColor={taxExempt ? colors.primary : colors.muted}
          accessibilityLabel="I'm tax-exempt"
          accessibilityRole="switch"
        />
      </View>

      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 32 }}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onBack}
          style={{
            flex: 1,
            paddingVertical: 15,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
          }}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 16 }}>
            Back
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onNext}
          style={{
            flex: 2,
            paddingVertical: 15,
            borderRadius: 14,
            backgroundColor: colors.primary,
            alignItems: "center",
          }}
          accessibilityLabel="Continue"
          accessibilityRole="button"
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
