import { Text, View, TouchableOpacity, Linking } from "react-native";
import Constants from "expo-constants";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SettingRow } from "@/components/settings/setting-row";
import { SectionHeader } from "@/components/settings/section-header";

export function AboutSection() {
  const colors = useColors();

  return (
    <>
      <SectionHeader title="About" />
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
        <SettingRow
          icon="info.circle.fill"
          label="Version"
          description="Product Stock Finder"
          right={
            <Text style={{ color: colors.muted, fontSize: 14 }}>
              {Constants.expoConfig?.version ?? "dev"}
            </Text>
          }
        />
        <TouchableOpacity activeOpacity={0.7}
          onPress={() =>
            Linking.openURL(
              "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
            )
          }
          accessibilityLabel="Open privacy policy"
          accessibilityRole="link"
        >
          <SettingRow
            icon="eye.fill"
            label="Privacy Policy"
            right={
              <IconSymbol
                name="chevron.right"
                size={16}
                color={colors.muted}
              />
            }
          />
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7}
          onPress={() =>
            Linking.openURL("mailto:support@productstockfinder.app")
          }
          accessibilityLabel="Contact support"
          accessibilityRole="link"
        >
          <SettingRow
            icon="paperplane.fill"
            label="Contact Support"
            right={
              <IconSymbol
                name="chevron.right"
                size={16}
                color={colors.muted}
              />
            }
          />
        </TouchableOpacity>
      </View>

      <View style={{ alignItems: "center", marginTop: 32 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Product Stock Finder · v{Constants.expoConfig?.version ?? "dev"}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
          Track smarter. Buy better.
        </Text>
      </View>
    </>
  );
}
