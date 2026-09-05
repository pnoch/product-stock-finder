# Silent Failures + Auth Log Leak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate production logging behind `__DEV__`, remove secrets from auth logs, and make 6 silent catch blocks visible in dev — with zero user-facing behavior change.

**Architecture:** Mechanical per-file edits following the `lib/_core/api.ts:5-6` gated-logger precedent (`const LOG = __DEV__ ? console.log.bind(console) : () => {};` + `LOG_ERROR`). One guard-test file pins all assertions. `tests/setup.ts:1` defines `__DEV__`, so gated loggers are safe in vitest.

**Tech Stack:** TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-silent-failures-design.md`

---

### Task 1: Guard tests for gated logging

**Files:**
- Create: `tests/silent-failures.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("silent failures", () => {
  it("keeps secrets and bare console calls out of auth.ts", async () => {
    const text = await readFile("lib/_core/auth.ts", "utf8");
    expect(text).toContain("const LOG = __DEV__");
    expect(text).not.toContain("console.log(");
    expect(text).not.toContain("console.error(");
    expect(text).not.toContain("substring(0, 20)");
    expect(text).not.toContain(", user);");
  });

  it("logs notification settings-read failures", async () => {
    const text = await readFile("lib/notifications.ts", "utf8");
    expect(text).toContain("settings read failed");
  });

  it("logs watchlist background failures", async () => {
    const text = await readFile("app/(tabs)/watchlist.tsx", "utf8");
    expect(text).toContain("queued-count refresh failed");
    expect(text).toContain("settings persist failed");
    expect(text).toContain("[Watchlist] share failed");
  });

  it("logs image-share fallback on compare and product screens", async () => {
    const compare = await readFile("app/compare/[id].tsx", "utf8");
    const product = await readFile("app/product/[id].tsx", "utf8");
    expect(compare).toContain("falling back to text");
    expect(product).toContain("falling back to text");
  });
});
```
NOTE: `console.log.bind(console)` in the gated definitions does NOT contain the substring `console.log(` (it is `console.log.bind(`), so the negative assertions hold once all call sites are renamed.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/silent-failures.test.ts 2>&1 | tail -4`
Expected: FAIL (4 failed — bare console calls and empty catches still present).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/silent-failures.test.ts
git commit -m "test: guard gated logging and silent-failure visibility"
```

---

### Task 2: Gate auth.ts logging, strip secrets

**Files:**
- Modify: `lib/_core/auth.ts`

- [ ] **Step 1: Add gated loggers after the import block**

Old (lines 1-3):
```ts
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";
```
New (append two lines):
```ts
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";

const LOG = __DEV__ ? console.log.bind(console) : () => {};
const LOG_ERROR = __DEV__ ? console.error.bind(console) : () => {};
```

- [ ] **Step 2: Rename all call sites, then strip secrets**

Replace every `console.log(` with `LOG(` and every `console.error(` with `LOG_ERROR(` throughout the file (mechanical, all occurrences). Then apply these three secret edits (names as renamed):

Edit A, old:
```ts
    console.log(
      "[Auth] Session token retrieved from SecureStore:",
      token ? `present (${token.substring(0, 20)}...)` : "missing",
    );
```
(actually now `LOG(` — match on the string content regardless of callee) new:
```ts
    LOG(
      "[Auth] Session token retrieved from SecureStore:",
      token ? "present" : "missing",
    );
```

Edit B, old:
```ts
    console.log(
      "[Auth] Setting session token...",
      token.substring(0, 20) + "...",
    );
```
new:
```ts
    LOG("[Auth] Setting session token...");
```

Edit C, old:
```ts
    console.log("[Auth] User info retrieved:", user);
```
new:
```ts
    LOG("[Auth] User info retrieved:", user.id);
```

Edit D, old:
```ts
    console.log("[Auth] Setting user info...", user);
```
new:
```ts
    LOG("[Auth] Setting user info...", user.id);
```

- [ ] **Step 3: Run the auth guard assertions**

Run: `pnpm vitest run tests/silent-failures.test.ts -t "out of auth" 2>&1 | tail -3`
Expected: the first `it` passes (others still fail — their files are later tasks).

- [ ] **Step 4: Typecheck**

Run: `pnpm check 2>&1 | tail -1`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add lib/_core/auth.ts
git commit -m "Fix: gate auth logging behind __DEV__, stop logging token prefix and user objects. TypeScript: 0 errors."
```

---

### Task 3: Log notification settings-read failures

**Files:**
- Modify: `lib/notifications.ts`

- [ ] **Step 1: Add gated loggers**

Read the import block first. Append after it:
```ts
const LOG_ERROR = __DEV__ ? console.error.bind(console) : () => {};
```
(Only `LOG_ERROR` is needed in this file. If the file already defines a gated logger, reuse it instead of adding a duplicate.)

- [ ] **Step 2: Log the quiet-hours settings failure**

Old:
```ts
    if (isInQuietHours(settings)) return null;
  } catch {}
```
New:
```ts
    if (isInQuietHours(settings)) return null;
  } catch (e) {
    LOG_ERROR("[Notifications] settings read failed, sending anyway", e);
  }
```
Semantics unchanged: the alert still sends (explicit fail-open per spec).

- [ ] **Step 3: Run the notification guard assertion**

Run: `pnpm vitest run tests/silent-failures.test.ts -t "notification settings" 2>&1 | tail -3`
Expected: that `it` passes.

- [ ] **Step 4: Commit**

```bash
git add lib/notifications.ts
git commit -m "Fix: log notification settings-read failures in dev (still sends). TypeScript: 0 errors."
```

---

### Task 4: Log watchlist background failures

**Files:**
- Modify: `app/(tabs)/watchlist.tsx`

- [ ] **Step 1: Add gated loggers**

Append after the import block:
```ts
const LOG_ERROR = __DEV__ ? console.error.bind(console) : () => {};
```
(If a gated logger already exists, reuse it.)

- [ ] **Step 2: Log the three silent catches**

Catch A, old:
```ts
        const meta = await getSyncMeta();
        if (!cancelled) setQueuedCount(countQueuedEdits(meta));
      } catch {}
```
new:
```ts
        const meta = await getSyncMeta();
        if (!cancelled) setQueuedCount(countQueuedEdits(meta));
      } catch (e) {
        LOG_ERROR("[Watchlist] queued-count refresh failed", e);
      }
```

Catch B, old:
```ts
        if (!cancelled) await saveSettings(next);
      } catch {}
```
new:
```ts
        if (!cancelled) await saveSettings(next);
      } catch (e) {
        LOG_ERROR("[Watchlist] settings persist failed", e);
      }
```

Catch C, old:
```ts
      await Share.share({ message, title: "My Watchlist" });
    } catch {}
```
new:
```ts
      await Share.share({ message, title: "My Watchlist" });
    } catch (e) {
      LOG_ERROR("[Watchlist] share failed", e);
    }
```
Flows unchanged: badge still freezes silently in prod (no toast — transient storage reads must not spam), persist still best-effort, share still silent on cancel.

- [ ] **Step 3: Run the watchlist guard assertion**

Run: `pnpm vitest run tests/silent-failures.test.ts -t "watchlist background" 2>&1 | tail -3`
Expected: that `it` passes.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/watchlist.tsx"
git commit -m "Fix: log watchlist background failures in dev. TypeScript: 0 errors."
```

---

### Task 5: Log image-share fallback on compare + product

**Files:**
- Modify: `app/compare/[id].tsx`, `app/product/[id].tsx`

- [ ] **Step 1: Add gated loggers to both files**

Append after each file's import block:
```ts
const LOG_ERROR = __DEV__ ? console.error.bind(console) : () => {};
```
(Reuse if already present.)

- [ ] **Step 2: Log the image-capture fallback (compare)**

Old:
```ts
      const imageShared = await captureAndShareImage(shareRef as React.RefObject<View | null>, `compare-${id}`);
```
Keep that line. Change the `} catch {}` that immediately follows its try block (the one before `try { const result = await Share.share(...)`) to:
```ts
    } catch (e) {
      LOG_ERROR("[Compare] image share failed, falling back to text", e);
    }
```
Do NOT touch the second `catch { return; }` around `Share.share` (user cancellation — intentionally silent per spec).

- [ ] **Step 3: Log the image-capture fallback (product)**

Same shape, with the `product-${id}` capture call. New catch body:
```ts
    } catch (e) {
      LOG_ERROR("[Product] image share failed, falling back to text", e);
    }
```
Same exclusion: leave the `Share.share` dismissal catch alone.

- [ ] **Step 4: Run the guard assertions**

Run: `pnpm vitest run tests/silent-failures.test.ts 2>&1 | tail -3`
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add "app/compare/[id].tsx" "app/product/[id].tsx"
git commit -m "Fix: log image-share fallback in dev on compare and product screens. TypeScript: 0 errors."
```

---

### Task 6: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Typecheck + lint**

Run: `pnpm check 2>&1 | tail -1` (expect clean) and `pnpm lint 2>&1 | tail -2` (expect 0 errors, no new warnings in the 5 touched files).

- [ ] **Step 2: Full test suite**

Run: `pnpm test 2>&1 | grep -E "^ *(Test Files|Tests) "`
Expected: all files pass, 0 failures (1367+ tests: 1363 before + 4 new guards).

- [ ] **Step 3: Push**

Run: `git push origin main 2>&1 | tail -1`
Expected: `main -> main` fast-forward. Confirm `git status --short` is empty.
