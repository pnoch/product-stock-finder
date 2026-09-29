import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { ScreenContainer } from "@/components/screen-container";
import { getApiBaseUrl } from "@/constants/oauth";
import { fetchCurrentUser } from "@/lib/auth-refresh";
import { publishAuthUser } from "@/hooks/use-auth";
import * as Auth from "@/lib/_core/auth";

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
        const baseUrl = getApiBaseUrl();
        // Without this, an unconfigured build fetched the relative path
        // "/api/auth/verify" and showed a confusing verification failure.
        if (!baseUrl) {
          if (!cancelled) {
            setError("This build isn't connected to a server. Open the link in the app that requested it.");
            setState("error");
          }
          return;
        }
        const res = await fetch(`${baseUrl}/api/auth/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          credentials: "include",
        });
        if (cancelled) return;
        if (res.ok) {
          setState("success");
          // Verification happened outside the app, so the cached user still says
          // emailVerified: false — refresh it or Settings keeps nagging until the
          // next sign-in.
          try {
            // Send the Bearer token: on React Native the session cookie is not
            // reliably sent cross-origin, so /api/auth/me 401'd and the
            // "verify your email" banner never cleared (the desktop needed the
            // same fix).
            const sessionToken = await Auth.getSessionToken();
            const refreshed = await fetchCurrentUser(
              baseUrl,
              sessionToken
                ? (input, init) =>
                    fetch(input, {
                      ...init,
                      headers: {
                        ...((init?.headers as Record<string, string>) ?? {}),
                        Authorization: `Bearer ${sessionToken}`,
                      },
                    })
                : fetch,
            );
            if (refreshed && !cancelled) {
              const user = {
                ...refreshed,
                lastSignedIn: new Date(refreshed.lastSignedIn),
              };
              publishAuthUser(user);
              await Auth.setUserInfo(user);
            }
          } catch {
            // best effort: the banner clears on the next sign-in
          }
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
