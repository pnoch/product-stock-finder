# Desktop Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop users can request and complete a password reset without leaving the app.

**Architecture:** Forgot form inline in Settings calling public `POST /api/auth/forgot`; new public `/reset-password` route calling `POST /api/auth/reset` — same endpoints and validation copy as mobile. No server or mobile changes.

**Tech Stack:** React, react-router, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-password-reset-design.md`

---

### Task 1: Guard tests for password reset

**Files:**
- Create: `tests/desktop-password-reset.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop password reset", () => {
  it("requests reset links from Settings", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("/api/auth/forgot");
    expect(text).toContain("Send reset link");
  });

  it("completes reset from the email-link route", async () => {
    const app = await readFile("desktop/src/App.tsx", "utf8");
    const page = await readFile("desktop/src/pages/ResetPassword.tsx", "utf8");
    expect(app).toContain("/reset-password");
    expect(page).toContain("/api/auth/reset");
    expect(page).toContain("Passwords do not match");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-password-reset.test.ts 2>&1 | tail -4`
Expected: FAIL (2 failed — second fails on missing file; if any string already exists, report instead of committing).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-password-reset.test.ts
git commit -m "test: guard desktop password reset flow"
```

---

### Task 2: Forgot-password form in Settings

**Files:**
- Modify: `desktop/src/pages/Settings.tsx`

- [ ] **Step 1: Add state + handler**

In the signed-out Account branch area (read exact markup — signed-out shows "Sign in to sync" + Sign-in button). Add state near other Account state:
```tsx
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotSending, setForgotSending] = useState(false);

  const handleForgotPassword = useCallback(async () => {
    const email = forgotEmail.trim();
    if (!email || !email.includes("@")) {
      setForgotMessage("Please enter a valid email address");
      return;
    }
    setForgotSending(true);
    setForgotMessage(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/forgot`, {
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
```
`getApiBaseUrl` is already imported (line 34). Check `useCallback` in react import; add if missing.

- [ ] **Step 2: Render form in the signed-out branch**

Below the Sign-in button row, inside the signed-out branch only:
```tsx
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Email for password reset"
                  className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
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
```
Match sibling input/button classes (read an existing input in Settings; adjust classes to match — the class strings above are the best guess, verify against file).

- [ ] **Step 3: Verify**

Run: `pnpm vitest run tests/desktop-password-reset.test.ts -t "requests reset"` (passes; route test fails) and `pnpm check` (clean).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Settings.tsx
git commit -m "Feat: desktop Settings forgot-password form. TypeScript: 0 errors."
```

---

### Task 3: Reset-password route + page

**Files:**
- Create: `desktop/src/pages/ResetPassword.tsx`
- Modify: `desktop/src/App.tsx`

- [ ] **Step 1: Create the page**

```tsx
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
```
Verify `useSearchParams` is exported from the installed `react-router` version (other desktop pages use `useParams` from "react-router" — check the package exports useSearchParams; if the version is v6, it does). If not available, report NEEDS_CONTEXT instead of guessing.

- [ ] **Step 2: Register the route**

In `desktop/src/App.tsx`: add `import { ResetPassword } from "./pages/ResetPassword";` with other page imports, and `<Route path="/reset-password" element={<ResetPassword />} />` before the `*` NotFound route (same area as the `/w/:token` route).

- [ ] **Step 3: Verify**

Run: `pnpm vitest run tests/desktop-password-reset.test.ts` (both pass), `pnpm check` (clean), workdir `desktop/` `pnpm build` (exit 0).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/ResetPassword.tsx desktop/src/App.tsx
git commit -m "Feat: desktop reset-password route and page. TypeScript: 0 errors."
```

---

### Task 4: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in the 3 touched files), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
