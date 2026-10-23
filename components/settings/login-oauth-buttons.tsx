import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function LoginOAuthButtons({
  colors,
  oauthProviders,
  oauthLoading,
  onOAuth,
}: {
  colors: Colors;
  oauthProviders: { google: boolean; apple: boolean };
  oauthLoading: "google" | "apple" | null;
  onOAuth: (provider: "google" | "apple") => void;
}) {
  return (
    <>
      {(oauthProviders.google || oauthProviders.apple) && (
        <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 16, gap: 12 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>
      )}

      {oauthProviders.google && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onOAuth("google")}
          disabled={!!oauthLoading}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: colors.background,
            borderRadius: 12,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 10,
            opacity: oauthLoading ? 0.6 : 1,
          }}
          accessibilityLabel="Continue with Google"
          accessibilityRole="button"
        >
          {oauthLoading === "google" ? (
            <ActivityIndicator size="small" color={colors.foreground} />
          ) : (
            <>
              <IconSymbol name="globe" size={18} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {oauthProviders.apple && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onOAuth("apple")}
          disabled={!!oauthLoading}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: colors.foreground,
            borderRadius: 12,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: colors.foreground,
            marginBottom: 12,
            opacity: oauthLoading ? 0.6 : 1,
          }}
          accessibilityLabel="Continue with Apple"
          accessibilityRole="button"
        >
          {oauthLoading === "apple" ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <>
              <IconSymbol name="globe" size={18} color={colors.background} />
              <Text style={{ color: colors.background, fontSize: 14, fontWeight: "600" }}>Continue with Apple</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </>
  );
}
