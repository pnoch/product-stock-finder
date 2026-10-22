import type { SyncStatus } from "../../../../lib/sync";

export function SignedOutAccountCard({
  syncStatus,
  syncStatusClass,
  onSignIn,
  emailAuth,
}: {
  syncStatus: SyncStatus;
  syncStatusClass: string;
  onSignIn: () => void;
  emailAuth: {
    authMode: "login" | "register";
    setAuthMode: (mode: "login" | "register") => void;
    authEmail: string;
    setAuthEmail: (value: string) => void;
    authPassword: string;
    setAuthPassword: (value: string) => void;
    authName: string;
    setAuthName: (value: string) => void;
    authError: string | null;
    authBusy: boolean;
    handleEmailAuth: () => void;
    forgotEmail: string;
    setForgotEmail: (value: string) => void;
    forgotMessage: string | null;
    forgotSending: boolean;
    handleForgotPassword: () => void;
  };
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Sign in to sync</p>
          <p className={`text-sm ${syncStatusClass}`}>
            {syncStatus.label}
          </p>
        </div>
        <button
          onClick={onSignIn}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
          aria-label="Sign in"
        >
          Sign in
        </button>
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => emailAuth.setAuthMode("login")}
            className={`px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium shrink-0 ${emailAuth.authMode === "login" ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
            aria-label="Sign in tab"
            aria-pressed={emailAuth.authMode === "login"}
          >
            Sign in
          </button>
          <button
            onClick={() => emailAuth.setAuthMode("register")}
            className={`px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium shrink-0 ${emailAuth.authMode === "register" ? "bg-gray-100 dark:bg-gray-800" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
            aria-label="Create account tab"
            aria-pressed={emailAuth.authMode === "register"}
          >
            Create account
          </button>
        </div>
        <div className="space-y-2">
          {emailAuth.authMode === "register" && (
            <input
              type="text"
              value={emailAuth.authName}
              onChange={(e) => emailAuth.setAuthName(e.target.value)}
              placeholder="Name (optional)"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              aria-label="Name"
            />
          )}
          <input
            type="email"
            value={emailAuth.authEmail}
            onChange={(e) => emailAuth.setAuthEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            aria-label="Email"
          />
          <div className="flex gap-2">
            <input
              type="password"
              value={emailAuth.authPassword}
              onChange={(e) => emailAuth.setAuthPassword(e.target.value)}
              placeholder="Password"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              aria-label="Password"
            />
            <button
              onClick={emailAuth.handleEmailAuth}
              disabled={emailAuth.authBusy}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 shrink-0"
              aria-label="Submit email authentication"
            >
              {emailAuth.authBusy ? "Working" : emailAuth.authMode === "login" ? "Sign in with email" : "Sign up with email"}
            </button>
          </div>
          {emailAuth.authError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{emailAuth.authError}</p>
          )}
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex gap-2">
          <input
            type="email"
            value={emailAuth.forgotEmail}
            onChange={(e) => emailAuth.setForgotEmail(e.target.value)}
            placeholder="Email for password reset"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            aria-label="Email for password reset"
          />
          <button
            onClick={emailAuth.handleForgotPassword}
            disabled={emailAuth.forgotSending}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 shrink-0"
            aria-label="Send reset link"
          >
            {emailAuth.forgotSending ? "Sending" : "Send reset link"}
          </button>
        </div>
        {emailAuth.forgotMessage && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{emailAuth.forgotMessage}</p>
        )}
      </div>
    </div>
  );
}
