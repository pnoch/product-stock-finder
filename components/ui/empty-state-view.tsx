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
  compact,
}: {
  icon: string;
  iconColor?: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  compact?: boolean;
}) {
  const colors = useColors();
  const primaryIconColor = iconColor ?? colors.primary;

  return (
    <View
      style={{
        alignItems: "center",
        paddingHorizontal: compact ? 16 : 32,
        marginTop: compact ? 8 : 48,
        paddingVertical: compact ? 8 : 0,
      }}
    >
      <View
        style={{
          width: compact ? 48 : 72,
          height: compact ? 48 : 72,
          borderRadius: compact ? 24 : 36,
          backgroundColor: primaryIconColor + "14",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: primaryIconColor + "22",
        }}
      >
        <IconSymbol
          name={icon as never}
          size={compact ? 22 : 30}
          color={primaryIconColor}
        />
      </View>
      <Text
        style={{
          color: colors.foreground,
          fontWeight: "700",
          fontSize: compact ? 14 : 16,
          marginTop: compact ? 10 : 16,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: colors.muted,
          fontSize: compact ? 13 : 14,
          textAlign: "center",
          marginTop: compact ? 4 : 8,
          lineHeight: compact ? 18 : 20,
        }}
      >
        {subtitle}
      </Text>
      {ctaLabel && onCtaPress && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            if (Platform.OS !== "web")
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onCtaPress();
          }}
          accessibilityLabel={ctaLabel}
          accessibilityRole="button"
          style={{
            backgroundColor: colors.primary,
            borderRadius: 20,
            paddingHorizontal: compact ? 18 : 24,
            paddingVertical: compact ? 8 : 12,
            marginTop: compact ? 12 : 20,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: compact ? 13 : 14 }}>
            {ctaLabel}
          </Text>
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
