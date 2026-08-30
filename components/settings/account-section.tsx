import {
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useColors } from "@/hooks/use-colors";
import { SettingRow } from "@/components/settings/setting-row";
import { SectionHeader } from "@/components/settings/section-header";
import type { SyncMeta } from "@/lib/types";
import type { User } from "@/lib/_core/auth";

export function AccountSection({
  isAuthenticated,
  user,
  syncMeta,
  syncing,
  onSyncNow,
  onSignOut,
  onSignIn,
  syncStatus,
}: {
  isAuthenticated: boolean;
  user: User | null | undefined;
  syncMeta: SyncMeta | null;
  syncing: boolean;
  onSyncNow: () => void;
  onSignOut: () => void;
  onSignIn: () => void;
  syncStatus: { label: string; tone: "muted" | "error" | "success" };
}) {
  const colors = useColors();

  return (
    <>
      <SectionHeader title="Account" />
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
        {isAuthenticated && user ? (
          <SettingRow
            icon="person.crop.circle.fill"
            label={user.name ?? "Signed in"}
            description={user.email ?? user.openId}
            right={
              <Text
                style={{
                  color: colors.success,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                Signed in
              </Text>
            }
          />
        ) : (
          <SettingRow
            icon="person.crop.circle.badge.plus"
            label="Sign in to sync"
            description="Sync your watchlist and alerts across devices"
            right={
              <TouchableOpacity
                onPress={onSignIn}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                  backgroundColor: colors.primary + "22",
                }}
                accessibilityLabel="Sign in"
                accessibilityRole="button"
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  Sign in
                </Text>
              </TouchableOpacity>
            }
          />
        )}
        <SettingRow
          icon="arrow.triangle.2.circlepath"
          label="Sync status"
          description={syncStatus.label}
          descriptionColor={
            syncStatus.tone === "error"
              ? colors.error
              : syncStatus.tone === "success"
                ? colors.success
                : undefined
          }
          right={
            isAuthenticated ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={onSyncNow}
                  disabled={syncing}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: colors.primary + "22",
                  }}
                  accessibilityLabel="Sync now"
                  accessibilityRole="button"
                >
                  {syncing ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 13,
                        fontWeight: "600",
                      }}
                    >
                      Sync now
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={onSignOut}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: colors.error + "22",
                  }}
                  accessibilityLabel="Sign out"
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      color: colors.error,
                      fontSize: 13,
                      fontWeight: "600",
                    }}
                  >
                    Sign out
                  </Text>
                </TouchableOpacity>
              </View>
            ) : undefined
          }
        />
      </View>
    </>
  );
}
