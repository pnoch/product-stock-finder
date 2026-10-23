import { useEffect, useState } from "react";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { getApiBaseUrl, getOAuthUrl } from "@/constants/oauth";
import { showAlert } from "@/lib/alert";

export function useLoginModal({
  visible,
  onClose,
  onLogin,
  onRegister,
  onForgotPassword,
}: {
  visible: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string, name?: string) => Promise<void>;
  onForgotPassword?: (email: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [oauthProviders, setOauthProviders] = useState<{ google: boolean; apple: boolean }>({ google: false, apple: false });

  useEffect(() => {
    if (!visible) return;
    let active = true;
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return;
    fetch(`${baseUrl}/api/auth/oauth/providers`)
      .then((res) => (res.ok ? res.json() : { google: false, apple: false }))
      .then((data) => {
        if (!active) return;
        setOauthProviders({
          google: data.google === true,
          apple: data.apple === true,
        });
      })
      .catch(() => {
        if (active) setOauthProviders({ google: false, apple: false });
      });
    return () => {
      active = false;
    };
  }, [visible]);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        await onLogin(email, password);
      } else {
        await onRegister(email, password, name || undefined);
      }
      setEmail("");
      setPassword("");
      setName("");
      if (mode === "register") {
        setMode("login");
        showAlert("Account created", "Sign in with your new password.");
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError(null);
  };

  const handleForgotSubmit = async () => {
    const targetEmail = forgotEmail.trim() || email.trim();
    if (!targetEmail) {
      setForgotError("Email is required");
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    try {
      if (onForgotPassword) {
        await onForgotPassword(targetEmail);
      } else {
        const baseUrl = getApiBaseUrl();
        if (!baseUrl) throw new Error("This build isn't connected to a server.");
        const res = await fetch(`${baseUrl}/api/auth/forgot`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: targetEmail }),
          credentials: "include",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to send reset email");
        }
      }
      setForgotSent(true);
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : "Failed");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setError(null);
    setOauthLoading(provider);
    try {
      const url = await getOAuthUrl(provider);
      if (!url) {
        setError("OAuth not configured. Set GOOGLE_CLIENT_ID / APPLE_CLIENT_ID on the server or configure API base URL.");
        return;
      }
      if (Platform.OS === "web") {
        window.location.href = url;
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(url, "productstockfinder:/oauth/callback");
      if (result.type === "cancel" || result.type === "dismiss") return;
      if (result.type === "success" && result.url) {
        await Linking.openURL(result.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth failed");
    } finally {
      setOauthLoading(null);
    }
  };

  const openForgot = () => {
    setForgotOpen(true);
    setForgotEmail(email);
    setForgotError(null);
    setForgotSent(false);
  };

  const closeForgot = () => {
    setForgotOpen(false);
    setForgotError(null);
    setForgotSent(false);
  };

  return {
    mode,
    focusedField,
    setFocusedField,
    email,
    setEmail,
    password,
    setPassword,
    name,
    setName,
    loading,
    error,
    forgotOpen,
    forgotEmail,
    setForgotEmail,
    forgotLoading,
    forgotError,
    forgotSent,
    oauthLoading,
    oauthProviders,
    handleSubmit,
    switchMode,
    handleForgotSubmit,
    handleOAuth,
    openForgot,
    closeForgot,
  };
}
