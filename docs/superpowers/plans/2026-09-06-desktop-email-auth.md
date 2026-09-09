# Desktop Email/Password Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop supports email/password sign-in, registration, and password change.

**Architecture:** Three exported async functions in `desktop/src/hooks/use-auth.ts` hitting existing public REST endpoints and the existing localStorage session + subscriber notify; inline Account-section UI reusing Settings patterns. No server or mobile changes.

**Tech Stack:** React, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-email-auth-design.md`

---

### Task 1: Guard tests for email auth

**Files:**
- Create: `tests/desktop-email-auth.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop email auth", () => {
  it("signs in and registers via REST", async () => {
    const text = await readFile("desktop/src/hooks/use-auth.ts", "utf8");
    expect(text).toContain("signInWithEmail");
    expect(text).toContain("signUpWithEmail");
    expect(text).toContain("/api/auth/login");
    expect(text).toContain("/api/auth/register");
  });

  it("changes passwords and wires Account UI", async () => {
    const hooks = await readFile("desktop/src/hooks/use-auth.ts", "utf8");
    const settings = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(hooks).toContain("changePassword");
    expect(hooks).toContain("/api/auth/change-password");
    expect(settings).toContain("Create account");
    expect(settings).toContain("New passwords do not match");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-email-auth.test.ts 2>&1 | tail -4`
Expected: FAIL (2 failed — verify strings truly absent first).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-email-auth.test.ts
git commit -m "test: guard desktop email/password auth"
```

---

### Task 2: Auth functions

**Files:**
- Modify: `desktop/src/hooks/use-auth.ts`

Read the file fully first (module fns getSessionToken/setUserInfo, `notify()`, `User` type `{id, openId, name, email, loginMethod, lastSignedIn: string}` — NO emailVerified field).

- [ ] **Step 1: Add imports + functions**

Add `getApiBaseUrl` to the api-base import (verify current import line first: `import { getAppId, getOAuthPortalUrl } from "../lib/api-base";`). Append:
```tsx
function mapUser(data: {
  id: number;
  openId: string | null;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: string;
}): User {
  return {
    id: data.id,
    openId: data.openId ?? "",
    name: data.name,
    email: data.email,
    loginMethod: data.loginMethod ?? "email",
    lastSignedIn: data.lastSignedIn,
  };
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Login failed");
  }
  const data = await res.json();
  if (data.sessionToken) setSessionToken(data.sessionToken);
  if (data.user) setUserInfo(mapUser(data.user));
  notify();
}

export async function signUpWithEmail(email: string, password: string, name?: string): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Registration failed");
  }
  const data = await res.json();
  if (data.sessionToken) setSessionToken(data.sessionToken);
  if (data.user) setUserInfo(mapUser(data.user));
  notify();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const token = getSessionToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${getApiBaseUrl()}/api/auth/change-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ currentPassword, newPassword }),
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Change password failed");
  }
}
```
Verify `notify()` name/signature (module function ~line 61) and `User` field optionality (map defensively as above; adjust if tsc demands).

- [ ] **Step 2: Verify**

Run: `pnpm vitest run tests/desktop-email-auth.test.ts -t "signs in and registers"` (passes; other fails) and `pnpm check` (clean).

- [ ] **Step 3: Commit**

```bash
git add desktop/src/hooks/use-auth.ts
git commit -m "Feat: desktop email/password auth functions. TypeScript: 0 errors."
```

---

### Task 3: Sign-in / sign-up UI

**Files:**
- Modify: `desktop/src/pages/Settings.tsx`

- [ ] **Step 1: Add form to the signed-out branch**

Read the signed-out Account branch first (Sign-in portal button + forgot form). Add tab state + form BELOW the portal button (portal stays first/primary):
```tsx
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
```
Tab toggle (Sign in / Create account buttons), inputs (email/password + name on register), submit:
```tsx
  const handleEmailAuth = async () => {
    if (!authEmail.includes("@") || !authPassword) {
      setAuthError("Please enter a valid email and password");
      return;
    }
    if (authMode === "register" && authPassword.length < 6) {
      setAuthError("Password must be at least 6 characters");
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    try {
      if (authMode === "login") await signInWithEmail(authEmail.trim(), authPassword);
      else await signUpWithEmail(authEmail.trim(), authPassword, authName.trim() || undefined);
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setAuthBusy(false);
    }
  };
```
Import the three functions from "../hooks/use-auth" (check existing import — Settings likely imports useAuth hook already; add names). Match input/button classes to the forgot form added earlier. Error `<p role="alert">`. Success needs nothing (session notify re-renders to signed-in).

- [ ] **Step 2: Verify**

Run: guard `-t "signs in and registers"` still passes (Create account string now present — full file: first test passes) + `pnpm check` clean. (Second test still fails — no "New passwords do not match" yet.)

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Settings.tsx
git commit -m "Feat: desktop email sign-in and registration UI. TypeScript: 0 errors."
```

---

### Task 4: Change-password UI

**Files:**
- Modify: `desktop/src/pages/Settings.tsx`

- [ ] **Step 1: Add form to the signed-in branch**

State + handler (place near Account state):
```tsx
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      setChangeError("Please fill in all password fields");
      return;
    }
    if (newPw !== confirmPw) {
      setChangeError("New passwords do not match");
      return;
    }
    if (newPw.length < 6) {
      setChangeError("Password must be at least 6 characters");
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
```
Verify `showToast` exists in Settings (used by earlier tasks — confirm name). Render in signed-in Account branch: three password inputs + button (match forgot-form classes), error `<p role="alert">`. Import changePassword (extend Task 3's import).

- [ ] **Step 2: Verify**

Run: full guard file (both pass) + `pnpm check` (clean).

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Settings.tsx
git commit -m "Feat: desktop change-password UI. TypeScript: 0 errors."
```

---

### Task 5: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in the 2 touched files), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
