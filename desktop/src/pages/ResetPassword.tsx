import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { getApiBaseUrl } from "../lib/api-base";

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    if (!token) {
      setError("Missing reset token. Please use the link from your email.");
      return;
    }
    if (!newPassword || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Password reset failed");
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="p-6 space-y-4 max-w-md">
        <h1 className="text-2xl font-bold text-red-600">Invalid Reset Link</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No token found. Please open the link from your reset email, or request a new link from Settings.
        </p>
        <Link to="/settings" className="inline-flex px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700">
          Back to Settings
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="p-6 space-y-4 max-w-md">
        <h1 className="text-2xl font-bold">Password Reset</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Your password has been reset. Please sign in with your new password.
        </p>
        <Link to="/settings" className="inline-flex px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700">
          Back to Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-md">
      <div>
        <h1 className="text-2xl font-bold">Reset Password</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter a new password for your account.</p>
      </div>
      <div className="space-y-3">
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password (min 6 characters)"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          aria-label="New password"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
          aria-label="Confirm new password"
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
      )}
      <button
        onClick={handleReset}
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
        aria-label="Reset password"
      >
        {loading ? "Resetting" : "Reset password"}
      </button>
    </div>
  );
}
