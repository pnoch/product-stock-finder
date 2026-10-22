import type { SyncStatus } from "../../../../lib/sync";

export function SignedInAccountCard({
  user,
  syncStatus,
  syncStatusClass,
  syncMessage,
  syncing,
  onSyncNow,
  onLogout,
  password,
}: {
  user: { name?: string | null; email?: string | null; openId: string; emailVerified?: boolean | null; loginMethod?: string | null };
  syncStatus: SyncStatus;
  syncStatusClass: string;
  syncMessage: string | null;
  syncing: boolean;
  onSyncNow: () => void;
  onLogout: () => void;
  password: {
    currentPw: string;
    setCurrentPw: (value: string) => void;
    newPw: string;
    setNewPw: (value: string) => void;
    confirmPw: string;
    setConfirmPw: (value: string) => void;
    changeError: string | null;
    changing: boolean;
    handleChangePassword: () => void;
    resending: boolean;
    handleResend: () => void;
  };
}) {
  return (
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
                onClick={password.handleResend}
                disabled={password.resending}
                className="ml-2 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                aria-label="Resend verification email"
              >
                {password.resending ? "Sending" : "Resend"}
              </button>
            </div>
          )}
          <p className={`text-xs mt-1 ${syncStatusClass}`}>{syncStatus.label}</p>
          {syncMessage && (<p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{syncMessage}</p>)}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSyncNow}
            disabled={syncing}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50"
            aria-label="Sync now"
          >
            {syncing ? "Syncing" : "Sync now"}
          </button>
          <button
            onClick={onLogout}
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
              value={password.currentPw}
              onChange={(e) => password.setCurrentPw(e.target.value)}
              placeholder="Current password"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              aria-label="Current password"
            />
            <input
              type="password"
              value={password.newPw}
              onChange={(e) => password.setNewPw(e.target.value)}
              placeholder="New password"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              aria-label="New password"
            />
            <input
              type="password"
              value={password.confirmPw}
              onChange={(e) => password.setConfirmPw(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              aria-label="Confirm new password"
            />
            <button
              onClick={password.handleChangePassword}
              disabled={password.changing}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 shrink-0"
              aria-label="Change password"
            >
              {password.changing ? "Changing" : "Change password"}
            </button>
            {password.changeError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">{password.changeError}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">Password sign-in isn&apos;t available for OAuth accounts</p>
        )}
      </div>
    </div>
  );
}
