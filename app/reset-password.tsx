import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { ScreenContainer } from "@/components/screen-container";
import { showAlert } from "@/lib/alert";

export default function ResetPasswordScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : Array.isArray(params.token) ? params.token[0] : undefined;
  const { resetPassword } = useAuth({ autoFetch: false });

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleReset = async () => {
    if (!token) {
      setError("Missing reset token. Please use the link from your email.");
      return;
    }
    if (!newPassword || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPassword(token, newPassword);
      showAlert("Password Reset", "Your password has been reset. Please sign in with your new password.");
      router.replace("/(tabs)/settings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: colors.error, fontSize: 16, fontWeight: "700", textAlign: "center" }}>Invalid Reset Link</Text>
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: "center" }}>
            No token found. Please open the link from your reset email, or request a new link from Settings → Sign in → Forgot password.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace("/(tabs)/settings")}
            style={{ marginTop: 20, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}
            accessibilityLabel="Back to settings"
            accessibilityRole="button"
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Back to Settings</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground, marginBottom: 8 }}>Reset Password</Text>
        <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 24 }}>Enter a new password for your account.</Text>

        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="New password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          autoCapitalize="none"
          onFocus={() => setFocusedField("newPassword")}
          onBlur={() => setFocusedField(null)}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: colors.foreground,
            borderWidth: 1,
            borderColor: focusedField === "newPassword" ? colors.primary : colors.border,
            marginBottom: 12,
          }}
          accessibilityLabel="New password"
        />

        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm new password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          autoCapitalize="none"
          onFocus={() => setFocusedField("confirmPassword")}
          onBlur={() => setFocusedField(null)}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: colors.foreground,
            borderWidth: 1,
            borderColor: focusedField === "confirmPassword" ? colors.primary : colors.border,
            marginBottom: 12,
          }}
          accessibilityLabel="Confirm new password"
        />

        {error && <Text style={{ color: colors.error, fontSize: 13, marginBottom: 12 }}>{error}</Text>}

        <TouchableOpacity
          onPress={handleReset}
          disabled={loading}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: "center",
            marginTop: 8,
            opacity: loading ? 0.6 : 1,
          }}
          accessibilityLabel="Reset password"
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Reset Password</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace("/(tabs)/settings")}
          style={{ alignItems: "center", marginTop: 16 }}
          accessibilityLabel="Back to settings"
          accessibilityRole="button"
        >
          <Text style={{ color: colors.primary, fontSize: 14 }}>Back to Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
