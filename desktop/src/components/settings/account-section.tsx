import { useCallback, useEffect, useState } from "react";
import { UserCircle } from "lucide-react";
import { useAuth, buildLoginUrl, signInWithEmail, signUpWithEmail, changePassword, resendVerification, refreshCurrentUser, validateEmailAuth, validateForgotEmail, validatePasswordChange } from "../../hooks/use-auth";
import { storage } from "../../storage";
import { getApiBaseUrl } from "../../lib/api-base";
import { getSyncSetup, formatSyncStatus, type SyncStatus } from "../../../../lib/sync";
import type { SyncMeta } from "../../../../lib/types";

export function AccountSection({
  now,
  showToast,
}: {
  now: number;
  showToast: (message: string) => void;
}) {
  const { user, isAuthenticated, login, logout } = useAuth();
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotSending, setForgotSending] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    queueMicrotask(() => {
      storage
        .getSyncMeta()
        .then((meta) => {
          if (!cancelled) setSyncMeta(meta);
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, now]);

  // Verification happens in a browser, so the cached user can go stale while
  // this page is open: refresh on mount and whenever the window regains focus.
  useEffect(() => {
    void refreshCurrentUser();
    const onFocus = () => void refreshCurrentUser();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const syncStatus: SyncStatus = syncMeta
    ? formatSyncStatus(syncMeta, isAuthenticated, now)
    : isAuthenticated
      ? { label: "Not synced yet", tone: "muted" }
      : getApiBaseUrl()
        ? { label: "Sign in to sync across devices", tone: "muted" }
        : { label: "Local-only mode — prices are fetched on this device", tone: "muted" };
  const syncStatusClass =
    syncStatus.tone === "error"
      ? "text-red-600 dark:text-red-400"
      : syncStatus.tone === "success"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-gray-500 dark:text-gray-400";

  const handleSignIn = async () => {
    await login(await buildLoginUrl());
  };

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
        // Registration no longer signs in (that would leak whether the email
        // already existed); send the user to sign in with the new password.
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

  const handleChangePassword = async () => {
    const validationError = validatePasswordChange(currentPw, newPw, confirmPw);
    if (validationError) {
      setChangeError(validationError);
      return;
    }
    setChanging(true);
    setChangeError(null);
    try {
      await changePassword(currentPw, newPw);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      showToast("Password changed");
    } catch (e) {
      setChangeError(e instanceof Error ? e.message : "Change password failed");
    } finally {
      setChanging(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    try {
      await resendVerification();
      showToast("Verification email sent — check your inbox.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Resend failed");
    } finally {
      setResending(false);
    }
  };

  const handleSyncNow = useCallback(async () => {
    const setup = getSyncSetup();
    if (syncing || !setup) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      await setup.syncNow();
      const meta = await storage.getSyncMeta();
      setSyncMeta(meta);
      setSyncMessage("Synced just now");
    } catch {
      setSyncMessage("Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <UserCircle className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Account</h2>
        </div>
        {isAuthenticated && user ? (
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{user.name ?? "Signed in"}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {user.email ?? user.openId}
                </p>
                {user.email != null && user.emailVerified === true && (
                  <span aria-label="Email verified" className="inline-block mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Verified</span>
                )}
                {user.email != null && !user.emailVerified && (
                  <div className="mt-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Check your email to verify your address.</span>
                    <button
                      onClick={() => void handleResend()}
                      disabled={resending}
                      className="ml-2 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                      aria-label="Resend verification email"
                    >
                      {resending ? "Sending" : "Resend"}
                    </button>
                  </div>
                )}
                <p className={`text-xs mt-1 ${syncStatusClass}`}>{syncStatus.label}</p>
                {syncMessage && (<p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{syncMessage}</p>)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
                  aria-label="Sync now"
                >
                  {syncing ? "Syncing" : "Sync now"}
                </button>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  aria-label="Sign out"
                >
                  Sign out
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {user.loginMethod === "email" ? (
              <>
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Current password"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                aria-label="Current password"
              />
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="New password"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                aria-label="New password"
              />
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                aria-label="Confirm new password"
              />
              <button
                onClick={handleChangePassword}
                disabled={changing}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 shrink-0"
                aria-label="Change password"
              >
                {changing ? "Changing" : "Change password"}
              </button>
              {changeError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">{changeError}</p>
              )}
              </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Password sign-in isn&apos;t available for OAuth accounts</p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Sign in to sync</p>
                <p className={`text-sm ${syncStatusClass}`}>
                  {syncStatus.label}
                </p>
              </div>
              <button
                onClick={handleSignIn}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
                aria-label="Sign in"
              >
                Sign in
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setAuthMode("login")}
                  className={`px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium shrink-0 ${authMode === "login" ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                  aria-label="Sign in tab"
                  aria-pressed={authMode === "login"}
                >
                  Sign in
                </button>
                <button
                  onClick={() => setAuthMode("register")}
                  className={`px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium shrink-0 ${authMode === "register" ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                  aria-label="Create account tab"
                  aria-pressed={authMode === "register"}
                >
                  Create account
                </button>
              </div>
              <div className="space-y-2">
                {authMode === "register" && (
                  <input
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Name (optional)"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                    aria-label="Name"
                  />
                )}
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                  aria-label="Email"
                />
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Password"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                    aria-label="Password"
                  />
                  <button
                    onClick={handleEmailAuth}
                    disabled={authBusy}
                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 shrink-0"
                    aria-label="Submit email authentication"
                  >
                    {authBusy ? "Working" : authMode === "login" ? "Sign in with email" : "Sign up with email"}
                  </button>
                </div>
                {authError && (
                  <p role="alert" className="text-sm text-red-600 dark:text-red-400">{authError}</p>
                )}
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Email for password reset"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                  aria-label="Email for password reset"
                />
                <button
                  onClick={handleForgotPassword}
                  disabled={forgotSending}
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 shrink-0"
                  aria-label="Send reset link"
                >
                  {forgotSending ? "Sending" : "Send reset link"}
                </button>
              </div>
              {forgotMessage && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{forgotMessage}</p>
              )}
            </div>
          </div>
        )}
      </div>

  );
}
