import { useCallback, useState } from "react";
import {
  signInWithEmail,
  signUpWithEmail,
  validateEmailAuth,
  validateForgotEmail,
} from "./use-auth";
import { getApiBaseUrl } from "../lib/api-base";

export function useEmailAuth({
  showToast,
}: {
  showToast: (message: string) => void;
}) {
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotSending, setForgotSending] = useState(false);

  const handleEmailAuth = async () => {
    const validationError = validateEmailAuth(
      authEmail,
      authPassword,
      authMode === "register",
    );
    if (validationError) {
      setAuthError(validationError);
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    try {
      if (authMode === "login") {
        await signInWithEmail(authEmail.trim(), authPassword);
        showToast("Signed in");
      } else {
        await signUpWithEmail(
          authEmail.trim(),
          authPassword,
          authName.trim() || undefined,
        );
        showToast("Account created — sign in to continue");
        setAuthMode("login");
      }
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleForgotPassword = useCallback(async () => {
    const email = forgotEmail.trim();
    const validationError = validateForgotEmail(email);
    if (validationError) {
      setForgotMessage(validationError);
      return;
    }
    setForgotSending(true);
    setForgotMessage(null);
    try {
      const baseUrl = getApiBaseUrl();
      if (!baseUrl) throw new Error("This build isn't connected to a server.");
      const res = await fetch(`${baseUrl}/api/auth/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send reset email");
      }
      setForgotMessage("Check your email for a reset link");
      setForgotEmail("");
    } catch (e) {
      setForgotMessage(
        e instanceof Error ? e.message : "Failed to send reset email",
      );
    } finally {
      setForgotSending(false);
    }
  }, [forgotEmail]);

  return {
    authMode,
    setAuthMode,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authName,
    setAuthName,
    authError,
    authBusy,
    handleEmailAuth,
    forgotEmail,
    setForgotEmail,
    forgotMessage,
    forgotSending,
    handleForgotPassword,
  };
}
