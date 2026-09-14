import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { getApiBaseUrl } from "@/constants/oauth";

type State = "verifying" | "success" | "error";

export default function VerifyEmailScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : Array.isArray(params.token) ? params.token[0] : undefined;
  const [state, setState] = useState<State>("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      setError("Missing verification token. Please use the link from your email.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/auth/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          credentials: "include",
        });
        if (cancelled) return;
        if (res.ok) {
          setState("success");
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Verification failed");
          setState("error");
        }
      } catch {
        if (!cancelled) {
          setError("Verification failed. Please try again.");
          setState("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <ScreenContainer>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        {state === "verifying" && (
          <>
            <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Verifying" />
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 12 }}>Verifying your email…</Text>
          </>
        )}
        {state === "success" && (
          <>
            <Text style={{ color: colors.success, fontSize: 18, fontWeight: "700", textAlign: "center" }}>Email Verified</Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: "center" }}>
              Your email address has been confirmed.
            </Text>
          </>
        )}
        {state === "error" && (
          <>
            <Text style={{ color: colors.error, fontSize: 18, fontWeight: "700", textAlign: "center" }}>Verification Failed</Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, textAlign: "center" }}>
              {error ?? "This link may have expired. Request a new one from Settings."}
            </Text>
          </>
        )}
        {state !== "verifying" && (
          <TouchableOpacity
            onPress={() => router.replace("/(tabs)/settings")}
            style={{ marginTop: 20, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}
            accessibilityLabel="Back to settings"
            accessibilityRole="button"
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Back to Settings</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScreenContainer>
  );
}
