import { Text, View, TouchableOpacity, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function EmptyStateView({
  icon,
  iconColor,
  title,
  subtitle,
  ctaLabel,
  onCtaPress,
  secondaryLabel,
  onSecondaryPress,
}: {
  icon: string;
  iconColor?: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
}) {
  const colors = useColors();
  const primaryIconColor = iconColor ?? colors.primary;

  return (
    <View style={{ alignItems: "center", paddingHorizontal: 32, marginTop: 48 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: primaryIconColor + "14",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: primaryIconColor + "22",
        }}
      >
        <IconSymbol name={icon as never} size={30} color={primaryIconColor} />
      </View>
      <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16, marginTop: 16, textAlign: "center" }}>
        {title}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 20 }}>
        {subtitle}
      </Text>
      {ctaLabel && onCtaPress && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onCtaPress();
          }}
          accessibilityLabel={ctaLabel}
          accessibilityRole="button"
          style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 12, marginTop: 20 }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
      {secondaryLabel && onSecondaryPress && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onSecondaryPress}
          accessibilityLabel={secondaryLabel}
          accessibilityRole="button"
          style={{ marginTop: 12, padding: 8 }}
        >
          <Text style={{ color: colors.primary, fontWeight: "600" }}>{secondaryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
