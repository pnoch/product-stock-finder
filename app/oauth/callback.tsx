import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  setSessionToken,
  setUserInfo,
  type User,
} from "@/lib/_core/auth";
import {
  parseOAuthCallbackParams,
  redeemOAuthTicket,
} from "@/lib/oauth-callback";
import { getApiBaseUrl } from "@/constants/oauth";
import { getDeviceId } from "@/lib/device-id";
import { useColors } from "@/hooks/use-colors";

export default function OAuthCallback() {
  const router = useRouter();
  const colors = useColors();
  const params = useLocalSearchParams<{
    ticket?: string;
    error?: string;
    error_description?: string;
  }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const action = parseOAuthCallbackParams({
        ticket: params.ticket,
        error: params.error,
        error_description: params.error_description,
      });
      if (action.action === "redirect") {
        if (!cancelled) router.replace("/");
        return;
      }
      if (action.action === "failed") {
        if (!cancelled) setError(action.message);
        return;
      }
      try {
        const baseUrl = getApiBaseUrl();
        if (!baseUrl) throw new Error("API base URL is not configured");
        const deviceId = await getDeviceId().catch(() => undefined);
        const { sessionToken, user } = await redeemOAuthTicket(action.ticket, {
          baseUrl,
          deviceId,
        });
        const rawUser = (user ?? {}) as Record<string, unknown>;
        const id =
          typeof rawUser.id === "number" ? rawUser.id : Number(rawUser.id);
        const openId = typeof rawUser.openId === "string" ? rawUser.openId : "";
        if (!Number.isFinite(id) || !openId) {
          throw new Error("OAuth sign-in returned an invalid user");
        }
        const normalized: User = {
          id,
          openId,
          name: typeof rawUser.name === "string" ? rawUser.name : null,
          email: typeof rawUser.email === "string" ? rawUser.email : null,
          loginMethod:
            typeof rawUser.loginMethod === "string"
              ? rawUser.loginMethod
              : "oauth",
          lastSignedIn: new Date(),
          emailVerified: rawUser.emailVerified === true,
        };
        await setSessionToken(sessionToken);
        await setUserInfo(normalized);
        if (!cancelled) router.replace("/");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "OAuth sign-in failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.ticket, params.error, params.error_description, router]);

  if (!error) return null;
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: colors.background,
      }}
    >
      <Text
        style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}
      >
        Sign-in failed
      </Text>
      <Text style={{ marginTop: 8, color: colors.muted, textAlign: "center" }}>
        {error}
      </Text>
    </View>
  );
}
