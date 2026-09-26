import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import {
  Palette,
  DollarSign,
  Bell,
  Clock,
  Download,
  Upload,
  Trash2,
  Activity,
  Globe,
  UserCircle,
  MonitorSmartphone,
  Share2,
  Pencil,
  LogOut,
  X,
  Info,
} from "lucide-react";
import { useSettings } from "../hooks/use-storage";
import { useToast } from "../hooks/use-toast";
import { storage } from "../storage";
import { clearDistributorBreaker } from "../../../lib/scrapers/breaker-clear";
import type { StorageAdapter } from "../../../lib/storage/adapter";
import { startPricePoller, stopPricePoller } from "../background";
import { EXCHANGE_RATES, CURRENCY_SYMBOLS } from "@shared/currency";
import {
  exportWatchlistAsJson,
  importWatchlistFromJson,
} from "../import-export";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useConnection } from "../hooks/use-connection";
import { ConnectionBadge } from "../components/ConnectionBadge";
import { DialogOverlay } from "../components/DialogOverlay";
import { useAuth, buildLoginUrl, signInWithEmail, signUpWithEmail, changePassword, deleteAccount, resendVerification, refreshCurrentUser, validateEmailAuth, validateForgotEmail, validatePasswordChange } from "../hooks/use-auth";
import { getApiBaseUrl } from "../lib/api-base";
import { trpc } from "../lib/trpc";
import { getDesktopDeviceId } from "../lib/device-id";
import { formatLastRefreshed } from "../../../lib/last-refreshed";
import { formatLastSeen } from "../../../lib/relative-time";
import { getSyncSetup, formatSyncStatus, type SyncStatus } from "../../../lib/sync";
import type { DeviceInfo } from "../../../server/devices";
import { buildBackup, parseBackup, applyBackup } from "../../../lib/backup";
import { watchlistToCsv } from "../../../lib/csv";
import type { AppSettings, Product, DistributorListing, SyncMeta } from "../../../lib/types";
import { getDistributorById } from "@shared/distributors";
import { getAllParserIds } from "../../../lib/scrapers/registry";
import { requestWebNotificationPermission } from "../../../lib/web-notifications";
import { isPushSupported, ensurePushSubscription, disablePush, getPushStatus, hasVapidKey } from "../lib/web-push";
import { getSupportMailtoUrl, getPrivacyPolicyUrl } from "../../../lib/legal-links";
import packageJson from "../../package.json";
import { externalLinkHandler } from "../lib/open-external";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const QUIET_HOURS_OPTIONS = ["Off", "22:00–07:00", "23:00–07:00", "00:00–08:00"] as const;

type SharedLink = { token: string; title: string; shareUrl: string; expiresAt: string | null; membersOnly: boolean };

function SharedLinksList() {
  const { showToast } = useToast();
  const listQuery = trpc.sharedWatchlists.list.useQuery();
  const extendMutation = trpc.sharedWatchlists.extend.useMutation();
  const revokeMutation = trpc.sharedWatchlists.revoke.useMutation();
  const membersOnlyMutation = trpc.sharedWatchlists.setMembersOnly.useMutation();
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const links = ((listQuery.data?.links ?? []) as SharedLink[]);

  const setMembersOnly = async (token: string, next: boolean) => {
    if (busyToken) return;
    setBusyToken(token);
    try {
      await membersOnlyMutation.mutateAsync({ token, membersOnly: next });
      await listQuery.refetch();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyToken(null);
    }
  };

  const runFor = async (token: string, action: "copy" | "extend" | "revoke") => {
    if (busyToken) return;
    if (action === "copy") {
      const link = links.find((l) => l.token === token);
      if (!link) return;
      try {
        await navigator.clipboard.writeText(link.shareUrl);
        showToast("Copied");
      } catch {
        showToast("Couldn't copy link");
      }
      return;
    }
    setBusyToken(token);
    try {
      if (action === "extend") {
        const res = await extendMutation.mutateAsync({ token });
        await listQuery.refetch();
        showToast(`Extended to ${new Date(res.expiresAt).toLocaleDateString()}`);
      } else {
        await revokeMutation.mutateAsync({ token });
        await listQuery.refetch();
        showToast("Link revoked");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyToken(null);
    }
  };

  if (listQuery.isLoading) return <LoadingSpinner />;
  if (listQuery.isError || links.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {links.map((link) => {
        const busy = busyToken === link.token;
        const expired = link.expiresAt ? new Date(link.expiresAt).getTime() < Date.now() : false;
        return (
          <div key={link.token} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
            <p className="text-sm font-semibold truncate">{link.title}</p>
            <p className={`text-xs mt-0.5 ${expired ? "text-red-500" : "text-gray-500"}`}>
              {link.expiresAt ? `${expired ? "Expired" : "Expires"} ${new Date(link.expiresAt).toLocaleDateString()}` : "No expiry"}
            </p>
            <div className="flex gap-2 mt-2">
              {([["copy", "Copy"], ["extend", "Extend 30d"], ["revoke", "Revoke"]] as const).map(([action, label]) => (
                <button
                  key={action}
                  onClick={() => void runFor(link.token, action)}
                  disabled={busy}
                  aria-label={`${label} share link ${link.title}`}
                  className={`text-xs px-2 py-1 rounded border bg-white dark:bg-gray-800 disabled:opacity-50 ${action === "revoke" ? "text-red-500" : "text-brand-600"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {!expired && (
              <SharedLinkMembers
                token={link.token}
                membersOnly={link.membersOnly}
                onToggleMembersOnly={(next) => void setMembersOnly(link.token, next)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Owner-side member roster + invite-by-email for one share link.
function SharedLinkMembers({
  token,
  membersOnly,
  onToggleMembersOnly,
}: {
  token: string;
  membersOnly: boolean;
  onToggleMembersOnly: (next: boolean) => void;
}) {
  const { showToast } = useToast();
  const membersQuery = trpc.sharedWatchlists.members.useQuery({ token });
  const inviteMutation = trpc.sharedWatchlists.inviteByEmail.useMutation();
  const removeMutation = trpc.sharedWatchlists.removeMember.useMutation();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const members = membersQuery.data?.members ?? [];

  const invite = async () => {
    if (!email.trim() || busy) return;
    setBusy(true);
    try {
      const res = await inviteMutation.mutateAsync({ token, email: email.trim() });
      await membersQuery.refetch();
      setEmail("");
      showToast(`Invited ${res.name}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (userId: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await removeMutation.mutateAsync({ token, userId });
      await membersQuery.refetch();
      showToast("Member removed");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-1">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={membersOnly}
          onChange={(e) => onToggleMembersOnly(e.target.checked)}
          aria-label="Members only"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Members only (the link alone won&apos;t work)
        </span>
      </label>
      {members.map((m) => {
        const label = m.name ?? m.email ?? `User ${m.userId}`;
        return (
          <div key={m.userId} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate">{label}</span>
            <button
              onClick={() => void removeMember(m.userId)}
              disabled={busy}
              aria-label={`Remove ${label}`}
              className="text-xs text-red-500 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        );
      })}
      {members.length === 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">No members yet</p>
      )}
      <div className="flex items-center gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Invite by email"
          type="email"
          aria-label="Invite member by email"
          className="flex-1 text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
        />
        <button
          onClick={() => void invite()}
          disabled={busy || !email.trim()}
          aria-label="Send invite"
          className="text-xs px-2 py-1 rounded border bg-white dark:bg-gray-800 text-brand-600 disabled:opacity-50"
        >
          Invite
        </button>
      </div>
    </div>
  );
}

// Shares the signed-in user was invited to / joined ("Shared with me").
function JoinedSharedList() {
  const { showToast } = useToast();
  const joinedQuery = trpc.sharedWatchlists.listJoined.useQuery();
  const leaveMutation = trpc.sharedWatchlists.leave.useMutation();
  const [busy, setBusy] = useState(false);
  const shares = joinedQuery.data?.shares ?? [];

  if (joinedQuery.isLoading || shares.length === 0) return null;

  const leave = async (token: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await leaveMutation.mutateAsync({ token });
      await joinedQuery.refetch();
      showToast("Left shared watchlist");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Leave failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      {shares.map((s) => (
        <div
          key={s.token}
          className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
        >
          <p className="text-sm font-semibold truncate">{s.title}</p>
          <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400 truncate">
            Shared by {s.ownerName ?? "another user"}
            {s.membersOnly ? " · members only" : ""}
          </p>
          <div className="flex gap-2 mt-2">
            <Link
              to={`/w/${s.token}`}
              aria-label={`Open ${s.title}`}
              className="text-xs px-2 py-1 rounded border bg-white dark:bg-gray-800 text-brand-600"
            >
              Open
            </Link>
            <button
              onClick={() => void leave(s.token)}
              disabled={busy}
              aria-label={`Leave ${s.title}`}
              className="text-xs px-2 py-1 rounded border bg-white dark:bg-gray-800 text-red-500 disabled:opacity-50"
            >
              Leave
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Settings() {
  const { settings, loading, update } = useSettings();
  const navigate = useNavigate();
  const prevIntervalRef = useRef<string | undefined>(settings?.checkInterval);
  useEffect(() => {
    const prev = prevIntervalRef.current;
    prevIntervalRef.current = settings?.checkInterval;
    let cancelled = false;
    (async () => {
      // Sequence stop BEFORE start. Firing both without awaiting let the start
      // be processed first (seeing POLLER_RUNNING=true and no-op'ing) and the
      // stop second, leaving no poller at all until the setting changed again.
      if (!settings || settings.checkInterval === "manual") {
        if (prev && prev !== "manual") await stopPricePoller();
        return;
      }
      if (prev && prev !== "manual" && prev !== settings.checkInterval) {
        await stopPricePoller();
      }
      const intervalMinutes = settings.checkInterval === "hourly" ? 60 : 1440;
      try {
        await startPricePoller(intervalMinutes, getApiBaseUrl());
      } catch {
        if (cancelled) return;
        showToast("Couldn't start background checks — reverted to Manual");
        console.error("[Settings] startPricePoller failed, reverting to manual");
        await update({ checkInterval: "manual" });
      }
    })();
    return () => { cancelled = true; };
  }, [settings?.checkInterval]);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [importExportMessage, setImportExportMessage] = useState<string | null>(
    null,
  );
  const { user, isAuthenticated, login, logout } = useAuth();
  const connection = useConnection();
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const refresh = async () => {
      const meta = await storage.getSyncMeta();
      if (!cancelled) {
        setSyncMeta(meta);
        setNow(Date.now());
      }
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  // Use the shared formatter so a failed sync surfaces (mobile's
  // formatSyncStatus reports lastSyncError); the previous inline logic always
  // showed the last-success time and hid errors.
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

  const handleEmailAuth = async () => {
    const validationError = validateEmailAuth(authEmail, authPassword, authMode === "register");
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
        await signUpWithEmail(authEmail.trim(), authPassword, authName.trim() || undefined);
        showToast("Account created");
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
      setForgotMessage(e instanceof Error ? e.message : "Failed to send reset email");
    } finally {
      setForgotSending(false);
    }
  }, [forgotEmail]);
  const [testNotifMessage, setTestNotifMessage] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const installedHandler = () => setDeferredPrompt(null);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") setDeferredPrompt(null);
    } catch (e) {
      console.warn("[Settings] install prompt failed", e);
    }
  };

  // AI / LLM — desktop port of mobile LlmSettingsSection
  const [showLlmApiKey, setShowLlmApiKey] = useState(false);
  const [draftLlmApiKey, setDraftLlmApiKey] = useState(settings?.llmApiKey ?? "");
  const [draftLlmModel, setDraftLlmModel] = useState(settings?.llmModel ?? "");
  const [draftLlmOllamaUrl, setDraftLlmOllamaUrl] = useState(settings?.llmOllamaUrl ?? "");

  useEffect(() => { setDraftLlmApiKey(settings?.llmApiKey ?? ""); }, [settings?.llmApiKey]);
  useEffect(() => { setDraftLlmModel(settings?.llmModel ?? ""); }, [settings?.llmModel]);
  useEffect(() => { setDraftLlmOllamaUrl(settings?.llmOllamaUrl ?? ""); }, [settings?.llmOllamaUrl]);

  useEffect(() => {
    if (draftLlmApiKey === (settings?.llmApiKey ?? "")) return;
    const t = setTimeout(() => { void update({ llmApiKey: draftLlmApiKey }); }, 500);
    return () => clearTimeout(t);
  }, [draftLlmApiKey, settings?.llmApiKey, update]);
  useEffect(() => {
    if (draftLlmModel === (settings?.llmModel ?? "")) return;
    const t = setTimeout(() => { void update({ llmModel: draftLlmModel }); }, 500);
    return () => clearTimeout(t);
  }, [draftLlmModel, settings?.llmModel, update]);
  useEffect(() => {
    if (draftLlmOllamaUrl === (settings?.llmOllamaUrl ?? "")) return;
    const t = setTimeout(() => { void update({ llmOllamaUrl: draftLlmOllamaUrl }); }, 500);
    return () => clearTimeout(t);
  }, [draftLlmOllamaUrl, settings?.llmOllamaUrl, update]);

  const handleTestNotification = useCallback(async () => {
    // Exercise the same path real alerts use (Tauri native, falling back to the
    // web Notification API). The old handler only called displayWebNotification,
    // which is a no-op in a Tauri webview (isWeb() is false), so "Test
    // notification sent" could appear without anything being shown.
    const { sendDesktopNotification } = await import("../notifications");
    const shown = await sendDesktopNotification(
      "Notifications working",
      "Product Stock Finder will alert you here.",
    );
    setTestNotifMessage(
      shown ? "Test notification sent" : "Notification permission not granted",
    );
  }, []);

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

  // Device management — desktop port of mobile DeviceManagementSection
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ deviceId: string; label: string | null } | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  const [testingLlm, setTestingLlm] = useState(false);
  const handleTestLlm = useCallback(async () => {
    if (testingLlm) return;
    setTestingLlm(true);
    try {
      const { testLlmConnection } = await import("../lib/server-llm");
      const res = await testLlmConnection();
      if (!res) {
        showToast("Couldn't reach the server. Try again.");
      } else if (res.ok) {
        showToast("Connection OK — provider responded");
      } else if (res.reason === "auth") {
        showToast("Check your API key — the provider rejected it");
      } else {
        showToast("Connection failed — check the URL and model");
      }
    } finally {
      setTestingLlm(false);
    }
  }, [testingLlm, showToast]);

  const [pushState, setPushState] = useState<"unknown" | "on" | "off">("unknown");
  const [pushBusy, setPushBusy] = useState(false);
  const [webNotifHint, setWebNotifHint] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !isPushSupported()) {
      setPushState("off");
      return;
    }
    let cancelled = false;
    void getPushStatus().then((s) => {
      if (!cancelled) setPushState(s);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const pushReason = !isAuthenticated
    ? "Sign in to enable push"
    : !isPushSupported()
      ? "Push isn't available in this browser"
      : !hasVapidKey()
        ? "Push isn't configured on this server"
        : null;

  const handleEnablePush = useCallback(async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const permission = await requestWebNotificationPermission();
      if (permission !== "granted") {
        showToast("Notification permission not granted");
        return;
      }
      const ok = await ensurePushSubscription();
      if (ok) {
        setPushState("on");
        showToast("Push notifications enabled");
      } else {
        showToast("Couldn't enable push notifications");
      }
    } finally {
      setPushBusy(false);
    }
  }, [pushBusy, showToast]);

  const handleDisablePush = useCallback(async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      await disablePush();
      setPushState("off");
      showToast("Push notifications disabled");
    } finally {
      setPushBusy(false);
    }
  }, [pushBusy, showToast]);

  const handleWebToggle = useCallback(async (v: boolean) => {
    if (v) {
      const permission = await requestWebNotificationPermission();
      const enabled = permission === "granted";
      await update({ webNotificationsEnabled: enabled });
      setWebNotifHint(
        enabled
          ? null
          : permission === "denied"
            ? "Notifications are blocked in your browser settings."
            : "Allow notifications in your browser to receive alerts.",
      );
    } else {
      await update({ webNotificationsEnabled: false });
      setWebNotifHint(null);
    }
  }, [update]);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [resending, setResending] = useState(false);

  // Verification happens in a browser, so the cached user can go stale while
  // this page is open: refresh on mount and whenever the window regains focus.
  useEffect(() => {
    void refreshCurrentUser();
    const onFocus = () => void refreshCurrentUser();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

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

  // Scraper Status — desktop port of mobile ScraperStatusSection
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [reenabling, setReenabling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    storage.getWatchlist().then((w) => {
      if (!cancelled) setProducts(w);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setProductsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const distributorStatuses = useMemo(() => {
    const statuses: Record<string, { lastSuccess: string | null; lastError: string | null; consecutiveFailures: number }> = {};
    const parserIds = getAllParserIds();
    for (const id of parserIds) {
      statuses[id] = { lastSuccess: null, lastError: null, consecutiveFailures: 0 };
    }
    for (const product of products) {
      if (!product.listings) continue;
      for (const listing of product.listings) {
        const id = listing.distributorId;
        if (!statuses[id]) {
          statuses[id] = { lastSuccess: null, lastError: null, consecutiveFailures: 0 };
        }
        if (listing.lastChecked) {
          const existing = statuses[id].lastSuccess;
          if (!existing || listing.lastChecked > existing) {
            statuses[id].lastSuccess = listing.lastChecked;
          }
        }
      }
    }
    return statuses;
  }, [products]);

  // Status glyphs are a coloured dot, not an emoji: emoji depend on a system
  // emoji font and render as empty boxes on many Linux desktops.
  const getDistributorHealth = (lastSuccess: string | null): { label: string; dot: string } => {
    if (!lastSuccess) {
      return { label: "Never Checked", dot: "bg-gray-400" };
    }
    const hoursSince = (Date.now() - new Date(lastSuccess).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) {
      return { label: "OK", dot: "bg-emerald-500" };
    }
    if (hoursSince < 168) {
      return { label: "Stale", dot: "bg-amber-500" };
    }
    return { label: "Failed", dot: "bg-red-500" };
  };

  const handleReenableDistributor = useCallback(async (distributorId: string) => {
    if (reenabling) return;
    setReenabling(true);
    try {
      const nowIso = new Date().toISOString();
      const tasks = products
        .filter((p) => p.listings?.some((l) => l.distributorId === distributorId))
        .map((product) => {
          const updatedListings: DistributorListing[] = (product.listings ?? []).map((l) =>
            l.distributorId === distributorId ? { ...l, lastChecked: nowIso } : l,
          );
          return storage.updateProductListings(product.id, updatedListings);
        });
      await Promise.all(tasks);
      // Clear the circuit breaker too. The health probe stores it through a
      // localStorage adapter; refreshing lastChecked alone left the distributor
      // in cooldown (still skipped) while the UI showed "OK" (mobile does the
      // same via clearDistributorBreaker).
      const breakerAdapter: Pick<StorageAdapter, "getItem" | "setItem"> = {
        getItem: async (k: string) => localStorage.getItem(k),
        setItem: async (k: string, v: string) => localStorage.setItem(k, v),
      };
      await clearDistributorBreaker(distributorId, breakerAdapter).catch(() => {});
      setProducts((prev) =>
        prev.map((p) => ({
          ...p,
          listings: p.listings?.map((l) =>
            l.distributorId === distributorId ? { ...l, lastChecked: nowIso } : l,
          ),
        })),
      );
      showToast("Distributor re-enabled");
    } catch {
      showToast("Could not re-enable distributor");
    } finally {
      setReenabling(false);
    }
  }, [products, reenabling]);

  const loadDevices = async () => {
    if (!isAuthenticated) return;
    setDevicesLoading(true);
    setDevicesError(null);
    try {
      const [devRes, curId] = await Promise.all([
        // Use the imperative client: `trpc.devices.list` is a React hook proxy
        // (no `.query()`), so calling it here always threw.
        (await import("../lib/trpc")).createTRPCClient().devices.list.query(),
        getDesktopDeviceId(),
      ]);
      setDevices(devRes?.devices ?? []);
      setCurrentDeviceId(curId);
    } catch (e) {
      setDevicesError(e instanceof Error ? e.message : String(e));
      setDevices(null);
    } finally {
      setDevicesLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadDevices();
  }, [isAuthenticated]);

  const handleRename = async () => {
    if (!renameTarget) return;
    const label = renameLabel.trim();
    if (!label) return;
    setRenaming(true);
    try {
      const client = (await import("../lib/trpc")).createTRPCClient();
      await client.devices.rename.mutate({ deviceId: renameTarget.deviceId, label });
      setRenameTarget(null);
      setRenameLabel("");
      await loadDevices();
      showToast("Device renamed");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setRenaming(false);
    }
  };

  const handleSignOutDevice = async (deviceId: string) => {
    if (!confirm("Sign out this device and remove it from your account?")) return;
    try {
      const client = (await import("../lib/trpc")).createTRPCClient();
      await client.devices.signOut.mutate({ deviceId });
      await loadDevices();
      showToast("Device signed out");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sign out failed");
    }
  };

  const handleShareWatchlist = async () => {
    if (sharing) return;
    setSharing(true);
    setShareError(null);
    try {
      const client = (await import("../lib/trpc")).createTRPCClient();
      const res = await client.sharedWatchlists.create.mutate({});
      setShareUrl(res.shareUrl);
      try {
        await navigator.clipboard.writeText(res.shareUrl);
        showToast("Share link copied");
      } catch {
        showToast("Share link created");
      }
    } catch (e) {
      setShareError(e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  };

  // Loading guard lives just before the main return below so every render
  // calls the same hooks (Rules of Hooks).

  const currencies = Object.keys(EXCHANGE_RATES);
  const llmProvider = settings?.llmProvider ?? "forge";

  const handleExport = async () => {
    try {
      const result = await exportWatchlistAsJson();
      setImportExportMessage(result);
    } catch (error) {
      setImportExportMessage("Export failed");
    }
  };

  const handleImport = async () => {
    try {
      const result = await importWatchlistFromJson();
      setImportExportMessage(result);
    } catch (error) {
      setImportExportMessage("Import failed");
    }
  };

  const handleExportCsv = useCallback(async () => {
    try {
      const [watchlist, appSettings] = await Promise.all([
        storage.getWatchlist(),
        storage.getSettings(),
      ]);
      const csv = watchlistToCsv(watchlist, appSettings.displayCurrency ?? "USD");
      const fileName = `product-stock-finder-watchlist-${new Date().toISOString().slice(0, 10)}.csv`;
      if (typeof window !== "undefined" && (window as unknown as { __TAURI__?: unknown }).__TAURI__) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeFile } = await import("@tauri-apps/plugin-fs");
        const filePath = await save({ defaultPath: fileName, filters: [{ name: "CSV", extensions: ["csv"] }] });
        if (!filePath) {
          setImportExportMessage("Export cancelled");
          return;
        }
        await writeFile(filePath, new TextEncoder().encode(csv));
        setImportExportMessage(`Exported to ${filePath}`);
      } else {
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setImportExportMessage("Watchlist exported as CSV");
      }
    } catch (e) {
      setImportExportMessage(e instanceof Error ? e.message : "CSV export failed");
    }
  }, []);

  const handleExportBackup = useCallback(async () => {
    try {
      const [watchlist, alerts, reminders, stockWatches, settings] = await Promise.all([
        storage.getWatchlist(),
        storage.getAlerts(),
        storage.getBackOrderReminders(),
        storage.getStockWatches(),
        storage.getSettings(),
      ]);
      const json = buildBackup({ watchlist, alerts, reminders, stockWatches, settings });
      const fileName = `product-stock-finder-backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (typeof window !== "undefined" && (window as unknown as { __TAURI__?: unknown }).__TAURI__) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeFile } = await import("@tauri-apps/plugin-fs");
        const filePath = await save({ defaultPath: fileName, filters: [{ name: "JSON", extensions: ["json"] }] });
        if (!filePath) {
          setImportExportMessage("Export cancelled");
          return;
        }
        await writeFile(filePath, new TextEncoder().encode(json));
        setImportExportMessage(`Exported to ${filePath}`);
      } else {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setImportExportMessage("Backup downloaded");
      }
    } catch (e) {
      setImportExportMessage(e instanceof Error ? e.message : "Backup export failed");
    }
  }, []);

  const handleImportBackup = useCallback(async () => {
    try {
      let contents: string | null = null;
      if (typeof window !== "undefined" && (window as unknown as { __TAURI__?: unknown }).__TAURI__) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const picked = await open({ filters: [{ name: "JSON", extensions: ["json"] }], multiple: false });
        if (!picked) {
          setImportExportMessage("Import cancelled");
          return;
        }
        const bytes = await readFile(picked as string);
        contents = new TextDecoder().decode(bytes);
      } else {
        contents = await new Promise<string | null>((resolve) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "application/json,.json";
          input.onchange = () => {
            const file = input.files?.[0];
            if (!file) {
              resolve(null);
              return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsText(file);
          };
          input.click();
        });
        if (!contents) {
          setImportExportMessage("Import cancelled");
          return;
        }
      }
      const backup = parseBackup(contents);
      if (!backup) {
        setImportExportMessage("That file is not a valid Product Stock Finder backup.");
        return;
      }
      const [watchlist, alerts, reminders, stockWatches, settings] = await Promise.all([
        storage.getWatchlist(),
        storage.getAlerts(),
        storage.getBackOrderReminders(),
        storage.getStockWatches(),
        storage.getSettings(),
      ]);
      const result = applyBackup(backup, { watchlist, alerts, reminders, stockWatches, settings });
      const summary = [
        `Watchlist: +${result.counts.watchlistAdded} new, ${result.counts.watchlistUpdated} updated`,
        `Alerts: +${result.counts.alertsAdded} new, ${result.counts.alertsUpdated} updated`,
        `Reminders: +${result.counts.remindersAdded} new, ${result.counts.remindersUpdated} updated`,
        `Stock watches: +${result.counts.stockWatchesAdded} new, ${result.counts.stockWatchesUpdated} updated`,
      ].join("\n");
      if (!confirm(`Import Backup?\n\n${summary}`)) return;
      await storage.saveWatchlist(result.watchlist);
      await storage.saveAlerts(result.alerts);
      await storage.saveBackOrderReminders(result.reminders);
      await storage.saveStockWatches(result.stockWatches);
      if (result.settingsApplied) await storage.saveSettings(result.settings);
      const now = Date.now();
      for (const idc of result.touchedIds.watchlist) await storage.setItemSyncMeta("watchlist", idc, now);
      for (const idc of result.touchedIds.alerts) await storage.setItemSyncMeta("alerts", idc, now);
      for (const idc of result.touchedIds.reminders) await storage.setItemSyncMeta("reminders", idc, now);
      for (const idc of result.touchedIds.stockWatches) await storage.setItemSyncMeta("reminders", idc, now);
      setImportExportMessage("Backup imported. Reloading…");
      window.location.reload();
    } catch (e) {
      setImportExportMessage(e instanceof Error ? e.message : "Backup import failed");
    }
  }, []);

  const handleClearAllData = async () => {
    try {
      await storage.clearAllData();
      setClearConfirm(false);
      window.location.reload();
    } catch (e) {
      // A storage failure must not reject unhandled with no feedback.
      setImportExportMessage(e instanceof Error ? e.message : "Couldn't clear data. Please try again.");
      setClearConfirm(false);
    }
  };

  const handleDeleteAccount = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      try {
        logout();
      } catch {
        // token is removed by the wipe below regardless
      }
      await storage.clearAllData();
      window.location.reload();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Server account deletion failed");
    } finally {
      setDeleting(false);
    }
  }, [deleting]);

  const deleteExpected = user?.email ?? "DELETE";
  const isDeleteConfirmed =
    user?.email != null
      ? deleteConfirmEmail.trim().toLowerCase() === deleteExpected.toLowerCase()
      : deleteConfirmEmail.trim() === deleteExpected;

  if (loading || !settings) return <LoadingSpinner />;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      {toast && <div role="status" className="fixed bottom-6 right-6 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-[60]">{toast}</div>}

      {/* Connection Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold mb-4">Connection</h2>
        <div className="flex items-center justify-between gap-4">
          <ConnectionBadge status={connection.status} />
          <button
            onClick={() => connection.refetch()}
            disabled={connection.isRefreshing}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium disabled:opacity-50"
            aria-label="Check connection now"
          >
            {connection.isRefreshing ? "Checking" : "Check Now"}
          </button>
        </div>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {connection.status === "connected"
            ? "Live price checks are active."
            : connection.status === "signed-out"
              ? "Sign in to sync prices with the backend."
              : "Backend unreachable. Showing saved prices."}
        </p>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          {connection.lastCheckedAt
            ? `Last checked ${formatLastRefreshed(new Date(connection.lastCheckedAt).toISOString())}`
            : "Never checked"}
        </p>
      </div>

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

      <button
        onClick={() => navigate("/health")}
        className="flex items-center gap-2 w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-brand-500 transition-colors"
        aria-label="View distributor health"
      >
        <Activity className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        <span className="text-left">
          <span className="block text-lg font-semibold">
            Distributor Health
          </span>
          <span className="block text-sm text-gray-500 dark:text-gray-400">
            View scraper status and run a live check
          </span>
        </span>
      </button>

      {/* Scraper Status — desktop port of mobile ScraperStatusSection */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Scraper Status</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {productsLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Loading distributor status…</p>
          ) : (
          <>{Object.entries(distributorStatuses)
            .filter(([id]) => getDistributorById(id))
            .map(([id, status]) => {
              const distributor = getDistributorById(id)!;
              const health = getDistributorHealth(status.lastSuccess);
              return (
                <div key={id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      <span
                        aria-hidden="true"
                        className={`inline-block w-2 h-2 rounded-full mr-1.5 align-middle ${health.dot}`}
                      />
                      {distributor.countryFlag} {distributor.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {status.lastSuccess
                        ? `Last checked: ${new Date(status.lastSuccess).toLocaleDateString()}`
                        : "Never checked"}
                    </p>
                  </div>
                  {health.label !== "OK" ? (
                    <button
                      onClick={() => handleReenableDistributor(id)}
                      disabled={reenabling}
                      className="ml-2 shrink-0 px-3 py-1.5 rounded-lg bg-brand-600/10 text-brand-600 dark:text-brand-400 text-xs font-semibold hover:bg-brand-600/20 disabled:opacity-50"
                      aria-label={`Re-enable ${distributor.name}`}
                    >
                      Re-enable
                    </button>
                  ) : (
                    <span className="ml-2 shrink-0 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {health.label}
                    </span>
                  )}
                </div>
              );
            })}
          {Object.keys(distributorStatuses).length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No distributors configured</p>
          )}
          </>
          )}
        </div>
      </div>

      {/* Device Management Section — desktop port */}
      {isAuthenticated && user && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3 mb-4">
            <MonitorSmartphone className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <h2 className="text-lg font-semibold">Device Management</h2>
            <button onClick={loadDevices} className="ml-auto text-xs text-brand-600 hover:underline" aria-label="Reload devices">Refresh</button>
          </div>
          {!devices && devicesLoading ? (
            <p className="text-sm text-gray-500">Loading devices…</p>
          ) : devicesError ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-amber-600">{devicesError}</p>
              <button onClick={loadDevices} className="text-sm text-brand-600 font-medium hover:underline">Retry</button>
            </div>
          ) : devices && devices.length === 0 ? (
            <p className="text-sm text-gray-500">No other devices bound to your account.</p>
          ) : devices ? (
            <div className="space-y-2">
              {devices.map((d) => {
                const isCurrent = d.deviceId === currentDeviceId;
                return (
                  <div key={d.deviceId} className={`flex items-center justify-between p-3 rounded-lg border ${isCurrent ? "border-brand-200 bg-brand-50 dark:bg-brand-900/10 dark:border-brand-800" : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30"}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{d.label ?? `${d.deviceId.slice(0, 12)}…`}</p>
                        {isCurrent && (
                          <span className="inline-flex shrink-0 px-1.5 py-0.5 rounded-lg bg-brand-600/15 text-brand-600 dark:text-brand-400 text-[10px] font-semibold">
                            This device
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{d.deviceId}</p>
                      {d.lastSeenAt > 0 && <p className="text-xs text-gray-400">{formatLastSeen(d.lastSeenAt)}</p>}
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button onClick={() => { setRenameTarget(d); setRenameLabel(d.label ?? ""); }} className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-600" aria-label={`Rename ${d.label ?? d.deviceId}`} title="Rename">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!isCurrent && (
                        <button onClick={() => handleSignOutDevice(d.deviceId)} className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20" aria-label={`Sign out ${d.label ?? d.deviceId}`} title="Sign out">
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          {renameTarget && (
            <DialogOverlay open onClose={() => setRenameTarget(null)} label="Rename device">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Rename device</h3>
                  <button onClick={() => setRenameTarget(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button>
                </div>
                <input value={renameLabel} onChange={(e) => setRenameLabel(e.target.value)} maxLength={64} placeholder="Device label" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm mb-3" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setRenameTarget(null)} className="px-3 py-2 rounded-lg border text-sm">Cancel</button>
                  <button onClick={handleRename} disabled={renaming || !renameLabel.trim()} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm disabled:opacity-50">{renaming ? "Saving…" : "Save"}</button>
                </div>
              </div>
            </DialogOverlay>
          )}
        </div>
      )}

      {/* Share Watchlist — desktop port of mobile SharedWatchlists */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-3">
          <Share2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Collaborative Watchlist</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Create a read-only public link to your watchlist. Anyone with the link can view it.</p>
        {!isAuthenticated ? (
          <p className="text-sm text-gray-500">Sign in to share your watchlist.</p>
        ) : (
          <>
            <button onClick={handleShareWatchlist} disabled={sharing} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50" aria-label="Create share link">
              {sharing ? "Creating link…" : "Share watchlist"}
            </button>
            {shareUrl && (
              <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 break-all">
                <p className="text-xs text-gray-500 mb-1">Share link (expires in 30 days):</p>
                <a href={shareUrl} target="_blank" rel="noopener noreferrer" onClick={externalLinkHandler(shareUrl)} className="text-sm text-brand-600 hover:underline break-all">{shareUrl}</a>
                <button onClick={() => { navigator.clipboard.writeText(shareUrl).then(() => showToast("Copied")).catch(() => showToast("Couldn't copy link")); }} className="ml-2 text-xs px-2 py-1 rounded border bg-white dark:bg-gray-800">Copy</button>
              </div>
            )}
            {shareError && <p className="text-sm text-amber-600 mt-2">{shareError}</p>}
            <SharedLinksList />
            <JoinedSharedList />
          </>
        )}
      </div>

      {/* Theme Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Palette className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Theme</h2>
        </div>
        <div className="flex gap-2">
          {(["light", "dark", "auto"] as const).map((t) => (
            <button
              key={t}
              onClick={() => update({ theme: t })}
              aria-pressed={settings.theme === t}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                settings.theme === t
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              aria-label={`Set theme to ${t}`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Currency Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Display Currency</h2>
        </div>
        <select
          value={settings.displayCurrency}
          onChange={(e) => update({ displayCurrency: e.target.value })}
          className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm shadow-sm dark:shadow-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
          aria-label="Display currency"
        >
          {currencies.map((currency) => (
            <option key={currency} value={currency}>
              {currency} ({CURRENCY_SYMBOLS[currency]})
            </option>
          ))}
        </select>
      </div>

      {/* Shipping Region Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Shipping Region</h2>
        </div>
        <select
          value={settings.shippingRegion ?? "Asia-Pacific"}
          onChange={(e) => update({ shippingRegion: e.target.value })}
          className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm shadow-sm dark:shadow-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
          aria-label="Shipping region"
        >
          {[
            "Asia-Pacific",
            "Europe",
            "North America",
            "Middle East",
            "Africa",
          ].map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
      </div>

      {/* Check Interval Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Check Interval</h2>
        </div>
        <div className="flex gap-2">
          {([
            { value: "manual", label: "Manual only" },
            { value: "hourly", label: "Every hour" },
            { value: "daily", label: "Once a day" },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => update({ checkInterval: value })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                settings.checkInterval === value
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              aria-label={`Set check interval to ${label}`}
              aria-pressed={settings.checkInterval === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">Notifications</h2>
        </div>
        <div className="space-y-1">
          <label className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors cursor-pointer">
            <span>
              <span className="block text-sm font-medium">Enable Notifications</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Receive alerts on your device</span>
            </span>
            <span className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) =>
                  update({ notificationsEnabled: e.target.checked })
                }
                className="sr-only peer"
                aria-label="Enable notifications"
              />
              <span className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:after:translate-x-full peer-checked:after:border-white transition-colors duration-300" />
            </span>
          </label>
          <label className={`flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors ${settings.notificationsEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
            <span>
              <span className="block text-sm font-medium">Stock Alerts</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Notify when item comes in stock</span>
            </span>
            <span className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.stockAlerts}
                onChange={(e) => update({ stockAlerts: e.target.checked })}
                disabled={!settings.notificationsEnabled}
                className="sr-only peer"
                aria-label="Enable stock alerts"
              />
              <span className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:after:translate-x-full peer-checked:after:border-white transition-colors duration-300" />
            </span>
          </label>
          <label className={`flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors ${settings.notificationsEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
            <span>
              <span className="block text-sm font-medium">Price Alerts</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Notify when price drops below target</span>
            </span>
            <span className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.priceAlerts}
                onChange={(e) => update({ priceAlerts: e.target.checked })}
                disabled={!settings.notificationsEnabled}
                className="sr-only peer"
                aria-label="Enable price alerts"
              />
              <span className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:after:translate-x-full peer-checked:after:border-white transition-colors duration-300" />
            </span>
          </label>
          <div className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors">
            <span>
              <span className="block text-sm font-medium">Push notifications</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                {pushState === "on" ? "On — alerts arrive even with the app closed." : (pushReason ?? "Off")}
              </span>
            </span>
            <button
              onClick={pushState === "on" ? handleDisablePush : handleEnablePush}
              disabled={pushBusy || (!isAuthenticated && pushState !== "on")}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={pushState === "on" ? "Disable push notifications" : "Enable push notifications"}
            >
              {pushBusy ? "Working" : pushState === "on" ? "Disable" : "Enable"}
            </button>
          </div>
          <label className="flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors cursor-pointer">
            <span>
              <span className="block text-sm font-medium">Web Notifications</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Show price and stock alerts in your browser</span>
            </span>
            <span className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!settings.webNotificationsEnabled}
                onChange={(e) => void handleWebToggle(e.target.checked)}
                className="sr-only peer"
                aria-label="Enable web notifications"
              />
              <span className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:after:translate-x-full peer-checked:after:border-white transition-colors duration-300" />
            </span>
          </label>
          {webNotifHint && (
            <p className="px-3 text-xs text-amber-600 dark:text-amber-400">{webNotifHint}</p>
          )}
          <label className={`flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors ${settings.notificationsEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
            <span>
              <span className="block text-sm font-medium">Health Alerts</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Notify when a distributor is blocked or down</span>
            </span>
            <span className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.healthAlerts}
                onChange={(e) => update({ healthAlerts: e.target.checked })}
                disabled={!settings.notificationsEnabled}
                className="sr-only peer"
                aria-label="Enable health alerts"
              />
              <span className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:after:translate-x-full peer-checked:after:border-white transition-colors duration-300" />
            </span>
          </label>
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Quiet Hours</p>
          <div className="flex gap-2 flex-wrap">
            {QUIET_HOURS_OPTIONS.map((option) => {
              const current = !settings.quietHours
                ? "Off"
                : `${settings.quietHours.start}–${settings.quietHours.end}`;
              return (
                <button
                  key={option}
                  onClick={() => {
                    if (option === "Off") {
                      update({ quietHours: undefined });
                    } else {
                      const [start, end] = option.split("–");
                      // Store only the window. `server-notifications.ts` stamps
                      // the device's current UTC offset when it uploads, so the
                      // server evaluates quiet hours in the user's timezone.
                      // Persisting the offset here synced a stale, possibly
                      // foreign (other-device) timezone into `settings`, which
                      // then mis-evaluated quiet hours locally.
                      update({ quietHours: { start, end } });
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    current === option
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                  aria-label={option === "Off" ? "Disable quiet hours" : `Set quiet hours to ${option}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {settings.quietHours && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Health alerts and digests are muted during quiet hours.
            </p>
          )}
        </div>
        <div className="mt-4">
          <button
            onClick={handleTestNotification}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            aria-label="Send test notification"
          >
            Test Notification
          </button>
          {testNotifMessage && (<p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{testNotifMessage}</p>)}
        </div>
      </div>

      {/* AI / LLM Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold mb-4">AI / LLM</h2>
        <label className="block text-sm font-medium mb-2" htmlFor="llm-provider">
          Provider
        </label>
        <select
          id="llm-provider"
          value={llmProvider}
          onChange={(e) => update({ llmProvider: e.target.value as AppSettings["llmProvider"] })}
          className="w-full max-w-xs px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm shadow-sm dark:shadow-none focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
          aria-label="LLM provider"
        >
          <option value="forge">Forge (Default)</option>
          <option value="openai">OpenAI</option>
          <option value="ollama">Ollama Cloud</option>
          <option value="ollama-local">Ollama Local</option>
        </select>

        {llmProvider !== "forge" && (
          <button
            onClick={() => void handleTestLlm()}
            disabled={testingLlm}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60"
            aria-label="Test LLM connection"
          >
            {testingLlm ? "Testing…" : "Test connection"}
          </button>
        )}

        {llmProvider === "openai" && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2" htmlFor="llm-api-key">
              API Key
            </label>
            <div className="flex items-center gap-2">
              <input
                id="llm-api-key"
                type={showLlmApiKey ? "text" : "password"}
                value={draftLlmApiKey}
                onChange={(e) => setDraftLlmApiKey(e.target.value)}
                onBlur={() => { if (draftLlmApiKey !== (settings.llmApiKey ?? "")) void update({ llmApiKey: draftLlmApiKey }); }}
                placeholder="sk-..."
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
              <button
                onClick={() => setShowLlmApiKey(!showLlmApiKey)}
                className="px-3 py-2 text-sm text-brand-600 dark:text-brand-400 font-medium"
                aria-label={showLlmApiKey ? "Hide API key" : "Show API key"}
              >
                {showLlmApiKey ? "Hide" : "Show"}
              </button>
            </div>

            <label className="block text-sm font-medium mt-4 mb-2" htmlFor="llm-model">
              Model
            </label>
            <input
              id="llm-model"
              type="text"
              value={draftLlmModel}
              onChange={(e) => setDraftLlmModel(e.target.value)}
              onBlur={() => { if (draftLlmModel !== (settings.llmModel ?? "")) void update({ llmModel: draftLlmModel }); }}
              placeholder="dall-e-3"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </div>
        )}

        {llmProvider === "ollama" && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2" htmlFor="llm-api-key">
              API Key
            </label>
            <div className="flex items-center gap-2">
              <input
                id="llm-api-key"
                type={showLlmApiKey ? "text" : "password"}
                value={draftLlmApiKey}
                onChange={(e) => setDraftLlmApiKey(e.target.value)}
                onBlur={() => { if (draftLlmApiKey !== (settings.llmApiKey ?? "")) void update({ llmApiKey: draftLlmApiKey }); }}
                placeholder="ollama_..."
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
              <button
                onClick={() => setShowLlmApiKey(!showLlmApiKey)}
                className="px-3 py-2 text-sm text-brand-600 dark:text-brand-400 font-medium"
                aria-label={showLlmApiKey ? "Hide API key" : "Show API key"}
              >
                {showLlmApiKey ? "Hide" : "Show"}
              </button>
            </div>

            <label className="block text-sm font-medium mt-4 mb-2" htmlFor="llm-ollama-url">
              Ollama URL
            </label>
            <input
              id="llm-ollama-url"
              type="text"
              value={draftLlmOllamaUrl}
              onChange={(e) => setDraftLlmOllamaUrl(e.target.value)}
              onBlur={() => { if (draftLlmOllamaUrl !== (settings.llmOllamaUrl ?? "")) void update({ llmOllamaUrl: draftLlmOllamaUrl }); }}
              placeholder="https://ollama.com"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />

            <label className="block text-sm font-medium mt-4 mb-2" htmlFor="llm-model">
              Model (optional)
            </label>
            <input
              id="llm-model"
              type="text"
              value={draftLlmModel}
              onChange={(e) => setDraftLlmModel(e.target.value)}
              onBlur={() => { if (draftLlmModel !== (settings.llmModel ?? "")) void update({ llmModel: draftLlmModel }); }}
              placeholder="gemma4"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </div>
        )}

        {llmProvider === "ollama-local" && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2" htmlFor="llm-ollama-url">
              Ollama URL
            </label>
            <input
              id="llm-ollama-url"
              type="text"
              value={draftLlmOllamaUrl}
              onChange={(e) => setDraftLlmOllamaUrl(e.target.value)}
              onBlur={() => { if (draftLlmOllamaUrl !== (settings.llmOllamaUrl ?? "")) void update({ llmOllamaUrl: draftLlmOllamaUrl }); }}
              placeholder="http://localhost:11434"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />

            <label className="block text-sm font-medium mt-4 mb-2" htmlFor="llm-model">
              Model (optional)
            </label>
            <input
              id="llm-model"
              type="text"
              value={draftLlmModel}
              onChange={(e) => setDraftLlmModel(e.target.value)}
              onBlur={() => { if (draftLlmModel !== (settings.llmModel ?? "")) void update({ llmModel: draftLlmModel }); }}
              placeholder="llava"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </div>
        )}

        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          {llmProvider === "forge"
            ? "Uses the built-in service. AI discovery and price insights run on the server; no key needed."
            : llmProvider === "openai"
              ? "Requires an OpenAI API key. Used for product discovery and price insights."
              : llmProvider === "ollama"
                ? "Uses Ollama Cloud. Requires an API key from ollama.com; used for product discovery and price insights."
                : "Runs against an Ollama server on the app server's host (loopback only). Run 'ollama pull llama3.2' to download the default model."}
        </p>
      </div>

      {/* Price Digest Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold mb-4">Price Digest</h2>
        <div className="flex gap-2">
          {(["off", "daily", "weekly"] as const).map((freq) => (
            <button
              key={freq}
              onClick={() => update({ digestFrequency: freq })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                (settings.digestFrequency ?? "off") === freq
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
              aria-label={`Set digest frequency to ${freq}`}
              aria-pressed={(settings.digestFrequency ?? "off") === freq}
            >
              {freq.charAt(0).toUpperCase() + freq.slice(1)}
            </button>
          ))}
        </div>
        {settings.digestFrequency === "weekly" && (
          <div className="flex gap-2 mt-2">
            {DAY_LABELS.map((day, index) => (
              <button
                key={day}
                onClick={() => update({ digestDayOfWeek: index })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  DAY_LABELS[settings.digestDayOfWeek ?? 0] === day
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
                aria-label={`Set digest day to ${day}`}
                aria-pressed={DAY_LABELS[settings.digestDayOfWeek ?? 0] === day}
              >
                {day}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Import/Export Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold mb-4">Data</h2>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
            aria-label="Export watchlist"
          >
            <Download className="w-4 h-4" /> Export Watchlist
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            aria-label="Import watchlist"
          >
            <Upload className="w-4 h-4" /> Import Watchlist
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            aria-label="Export CSV"
            title="Save watchlist as CSV (prices in display currency)"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
            aria-label="Export Backup"
            title="Save watchlist, alerts and settings to a file"
          >
            <Download className="w-4 h-4" /> Export Backup
          </button>
          <button
            onClick={handleImportBackup}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            aria-label="Import Backup"
            title="Restore from a backup file (merges by id)"
          >
            <Upload className="w-4 h-4" /> Import Backup
          </button>
        </div>
        {importExportMessage && (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {importExportMessage}
          </p>
        )}
      </div>

      {/* Clear All Data Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold mb-4">Danger Zone</h2>
        {isAuthenticated && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {/* A signed-in device re-syncs: clearing the local cursor makes the
                next sync pull everything back, so the button looked broken. */}
            Signed in: this clears this device&apos;s copy only. Your account&apos;s data
            stays on the server and re-syncs — use &quot;Delete Account &amp; Data&quot;
            to remove it everywhere.
          </p>
        )}
        {!clearConfirm ? (
          <button
            onClick={() => setClearConfirm(true)}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
            aria-label="Clear all data"
          >
            <Trash2 className="w-4 h-4" /> Clear All Data
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-red-600 dark:text-red-400">
              Are you sure?
            </span>
            <button
              onClick={handleClearAllData}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
              aria-label="Confirm clear all data"
            >
              Yes, clear all
            </button>
            <button
              onClick={() => setClearConfirm(false)}
              disabled={deleting}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
              aria-label="Cancel clear all data"
            >
              Cancel
            </button>
          </div>
        )}
          {isAuthenticated && user && (
            <div className="mt-4">
              {!deleteConfirm ? (
                <button
                  onClick={() => { setDeleteConfirmEmail(""); setDeleteConfirm(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                  aria-label="Delete account and data"
                >
                  <Trash2 className="w-4 h-4" /> Delete Account & Data
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    This permanently deletes your server account and all local data. This cannot be undone.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {user?.email
                      ? `Type your email (${user.email}) to confirm.`
                      : "Type DELETE to confirm."}
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmEmail}
                    onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                    placeholder={user?.email ? "Your email address" : "DELETE"}
                    className="w-full max-w-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    aria-label="Type to confirm account deletion"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting || !isDeleteConfirmed}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                      aria-label="Confirm delete account and data"
                    >
                      {deleting ? "Deleting" : "Yes, delete everything"}
                    </button>
                    <button
                      onClick={() => { setDeleteConfirmEmail(""); setDeleteConfirm(false); }}
                      disabled={deleting}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
                      aria-label="Cancel delete account and data"
                    >
                      Cancel
                    </button>
                  </div>
                  {deleteError && (
                    <p className="text-sm text-red-600 dark:text-red-400" role="alert">{deleteError}</p>
                  )}
                </div>
              )}
            </div>
          )}
      </div>

      {/* About Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Info className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <h2 className="text-lg font-semibold">About</h2>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <div className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-sm font-medium">Version</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Product Stock Finder
              </p>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {packageJson.version}
            </span>
          </div>
          {deferredPrompt && (
            <div className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium">Install app</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Add to home screen for offline access
                </p>
              </div>
              <button
                onClick={handleInstall}
                className="ml-2 shrink-0 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700"
                aria-label="Install app"
              >
                Install
              </button>
            </div>
          )}
          <div className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-sm font-medium">Contact Support</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Get help with the app
              </p>
            </div>
            <a
              href={getSupportMailtoUrl()}
              onClick={externalLinkHandler(getSupportMailtoUrl())}
              className="ml-2 shrink-0 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
              aria-label="Contact support"
            >
              Email us
            </a>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-sm font-medium">Privacy Policy</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                How we handle your data
              </p>
            </div>
            {getPrivacyPolicyUrl() ? (
              <a
                href={getPrivacyPolicyUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={externalLinkHandler(getPrivacyPolicyUrl())}
                className="ml-2 shrink-0 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                aria-label="Open privacy policy"
              >
                View
              </a>
            ) : (
              <span className="ml-2 shrink-0 text-xs text-gray-400" aria-label="Privacy policy not configured">
                Not configured
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
