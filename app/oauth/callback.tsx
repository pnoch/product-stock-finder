import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  setSessionToken,
  setUserInfo,
  type User,
} from "@/lib/_core/auth";
import { parseOAuthCallbackParams } from "@/lib/oauth-callback";

export default function OAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    sessionToken?: string;
    user?: string;
  }>();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const action = parseOAuthCallbackParams({
        sessionToken: params.sessionToken,
        user: params.user,
      });
      if (action.action === "authenticated") {
        const rawUser = action.user;
        const id =
          typeof rawUser.id === "number" ? rawUser.id : Number(rawUser.id);
        const openId = typeof rawUser.openId === "string" ? rawUser.openId : "";
        if (Number.isFinite(id) && openId) {
          const lastSignedInRaw = rawUser.lastSignedIn;
          const lastSignedInDate =
            typeof lastSignedInRaw === "string" ||
            typeof lastSignedInRaw === "number" ||
            lastSignedInRaw instanceof Date
              ? new Date(lastSignedInRaw)
              : new Date();
          const user: User = {
            id,
            openId,
            name: typeof rawUser.name === "string" ? rawUser.name : null,
            email: typeof rawUser.email === "string" ? rawUser.email : null,
            loginMethod:
              typeof rawUser.loginMethod === "string"
                ? rawUser.loginMethod
                : null,
            lastSignedIn: Number.isNaN(lastSignedInDate.getTime())
              ? new Date()
              : lastSignedInDate,
            emailVerified: rawUser.emailVerified === true,
          };
          await setSessionToken(action.sessionToken);
          await setUserInfo(user);
        }
      }
      if (!cancelled) router.replace("/");
    })();
    return () => {
      cancelled = true;
    };
  }, [params.sessionToken, params.user, router]);

  return null;
}
