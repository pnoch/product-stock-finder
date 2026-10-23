import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function AccountOAuthButtons({
  colors,
  oauthLoading,
  onOAuth,
}: {
  colors: Colors;
  oauthLoading: "google" | "apple" | null;
  onOAuth: (provider: "google" | "apple") => void;
}) {
  return (
    <View style={{ padding: 12, gap: 8 }}>
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
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: oauthLoading ? 0.6 : 1,
        }}
        accessibilityLabel="Continue with Google"
        accessibilityRole="button"
      >
        {oauthLoading === "google" ? (
          <ActivityIndicator size="small" color={colors.foreground} />
        ) : (
          <>
            <IconSymbol name="globe" size={16} color={colors.foreground} />
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>
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
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: colors.foreground,
          opacity: oauthLoading ? 0.6 : 1,
        }}
        accessibilityLabel="Continue with Apple"
        accessibilityRole="button"
      >
        {oauthLoading === "apple" ? (
          <ActivityIndicator size="small" color={colors.background} />
        ) : (
          <>
            <IconSymbol name="globe" size={16} color={colors.background} />
            <Text style={{ color: colors.background, fontSize: 13, fontWeight: "600" }}>Continue with Apple</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}
