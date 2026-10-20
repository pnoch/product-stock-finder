import { Pressable, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SettingRow } from "@/components/settings/setting-row";
import { SectionHeader } from "@/components/settings/section-header";

export function ProSection({ onUpgrade }: { onUpgrade: () => void }) {
  const colors = useColors();
  return (
    <>
      <SectionHeader title="Pro" />
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
          onPress={onUpgrade}
          accessibilityLabel="Upgrade to Pro"
          accessibilityRole="button"
        >
          <SettingRow
            icon="crown.fill"
            label="Upgrade to Pro"
            description="Unlock unlimited tracking, background monitoring, and sync."
            right={
              <IconSymbol
                name="chevron.right"
                size={16}
                color={colors.primary}
              />
            }
          />
        </Pressable>
      </View>
    </>
  );
}
