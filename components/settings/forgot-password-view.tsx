import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { useColors } from "@/hooks/use-colors";

type Colors = ReturnType<typeof useColors>;

export function ForgotPasswordView({
  colors,
  email,
  forgotEmail,
  onForgotEmail,
  focusedField,
  onFocus,
  onBlur,
  forgotError,
  forgotLoading,
  forgotSent,
  onSubmit,
  onClose,
}: {
  colors: Colors;
  email: string;
  forgotEmail: string;
  onForgotEmail: (value: string) => void;
  focusedField: string | null;
  onFocus: () => void;
  onBlur: () => void;
  forgotError: string | null;
  forgotLoading: boolean;
  forgotSent: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "700",
          color: colors.foreground,
          marginBottom: 4,
        }}
      >
        Reset password
      </Text>
      <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 20 }}>
        Enter your email and we will send a reset link
      </Text>

      {forgotSent ? (
        <>
          <View
            style={{
              backgroundColor: colors.background,
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.foreground, fontSize: 14, textAlign: "center" }}>
              If an account exists for {forgotEmail.trim() || email.trim()}, a reset email has been sent. Check your inbox.
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onClose}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              marginBottom: 12,
            }}
            accessibilityLabel="Back to sign in"
            accessibilityRole="button"
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Back to sign in</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            value={forgotEmail}
            onChangeText={onForgotEmail}
            placeholder={email || "Email"}
            placeholderTextColor={colors.muted}
            accessibilityLabel="Email for password reset"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            onFocus={onFocus}
            onBlur={onBlur}
            style={{
              backgroundColor: colors.background,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 16,
              color: colors.foreground,
              borderWidth: 1,
              borderColor: focusedField === "forgotEmail" ? colors.primary : colors.border,
              marginBottom: 12,
            }}
          />
          {forgotError && (
            <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 13, marginBottom: 12 }}>{forgotError}</Text>
          )}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onSubmit}
            disabled={forgotLoading}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              marginBottom: 12,
              opacity: forgotLoading ? 0.5 : 1,
            }}
            accessibilityLabel="Send reset email"
            accessibilityRole="button"
            accessibilityState={{ disabled: forgotLoading }}
          >
            {forgotLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Send reset email</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onClose}
            style={{ alignItems: "center" }}
            accessibilityLabel="Back to sign in"
            accessibilityRole="button"
          >
            <Text style={{ color: colors.primary, fontSize: 14 }}>Back to sign in</Text>
          </TouchableOpacity>
        </>
      )}
    </>
  );
}
