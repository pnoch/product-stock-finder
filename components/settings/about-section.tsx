import { useState } from "react";
import { Text, View, TouchableOpacity, Linking, ActivityIndicator, Platform } from "react-native";
import Constants from "expo-constants";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SettingRow } from "@/components/settings/setting-row";
import { SectionHeader } from "@/components/settings/section-header";
import { showAlert } from "@/lib/alert";
import { clearAllData } from "@/lib/storage";
import { useAuth } from "@/hooks/use-auth";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

export function AboutSection() {
  const colors = useColors();
  const { isAuthenticated, logout } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const handleDeleteMyData = () => {
    showAlert(
      "Delete My Data?",
      "This will permanently delete all local data (watchlist, alerts, reminders, settings) and, if signed in, delete your account on the server. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (deleting) return;
            setDeleting(true);
            try {
              if (isAuthenticated) {
                const baseUrl = getApiBaseUrl();
                if (baseUrl) {
                  try {
                    const headers: Record<string, string> = { "Content-Type": "application/json" };
                    if (Platform.OS !== "web") {
                      const token = await Auth.getSessionToken();
                      if (token) headers.Authorization = `Bearer ${token}`;
                    }
                    await fetch(`${baseUrl}/api/auth/account`, {
                      method: "DELETE",
                      headers,
                      credentials: "include",
                    });
                  } catch (e) {
                    console.warn("[AboutSection] server delete failed", e);
                  }
                }
                try {
                  await logout();
                } catch {}
              }
              await clearAllData();
              showAlert("Data Deleted", "All local data has been cleared.");
            } catch (e) {
              showAlert("Delete Failed", e instanceof Error ? e.message : String(e));
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

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
            Linking.openURL("https://productstockfinder.app/privacy")
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
          onPress={handleDeleteMyData}
          disabled={deleting}
          accessibilityLabel="Delete my data"
          accessibilityRole="button"
        >
          <SettingRow
            icon="trash.fill"
            label="Delete My Data"
            description="Clear local data and delete server account if signed in"
            right={
              deleting ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <IconSymbol
                  name="chevron.right"
                  size={16}
                  color={colors.muted}
                />
              )
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
