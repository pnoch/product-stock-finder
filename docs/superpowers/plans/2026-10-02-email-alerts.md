# Email Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Email the user when one of their alerts fires (price drop/rise, restock, back-order reminder), server-side and immediately, opt-in via a settings toggle.

**Architecture:** Reuse the server's existing per-user event pipeline (`evaluateNotifications` runs each warmer tick). After a user-scoped `notificationEvents` row is inserted, best-effort enqueue an email. Idempotency is keyed by `(userId, dedupKey)` in a new `notification_email_log` table so the cooldown's delete+reinsert cannot re-email. Delivery reuses `server/email.ts` (Resend); every email carries a signed one-click unsubscribe link.

**Tech Stack:** TypeScript, Express, tRPC, Drizzle (MySQL), Vitest, React Native/Expo (mobile), React (desktop), Resend HTTP API.

**Spec:** `docs/superpowers/specs/2026-10-02-email-alerts-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `lib/types.ts` | `AppSettings.emailAlerts` flag |
| `lib/storage/settings.ts` | default `emailAlerts: false` |
| `drizzle/schema.ts` | `notificationEmailLog` table |
| `server/notifications/email-alerts.ts` | token helpers, content builder, gated delivery, unsubscribe |
| `server/notifications/evaluate.ts` | enqueue email after user-event insert |
| `server/email-unsubscribe-route.ts` | public unsubscribe route (isolated, testable) |
| `server/_core/index.ts` | call the registrar |
| `components/settings/notifications-section.tsx` | mobile toggle |
| `desktop/src/pages/Settings.tsx` | desktop toggle |
| tests | unit + DB-gated |

---

## Task 1: Preference type + default

**Files:**
- Modify: `lib/types.ts:164` (inside `AppSettings`)
- Modify: `lib/storage/settings.ts:19` (`DEFAULT_SETTINGS`)
- Test: `tests/email-alerts-preference.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createStorage } from "../lib/storage";

function emptyStorage() {
  const store = new Map<string, string>();
  return createStorage({
    getItem: async (k) => store.get(k) ?? null,
    setItem: async (k, v) => void store.set(k, v),
    removeItem: async (k) => void store.delete(k),
    multiRemove: async (keys) => keys.forEach((k) => store.delete(k)),
  });
}

describe("emailAlerts preference default", () => {
  it("defaults to false when unset", async () => {
    const settings = await emptyStorage().getSettings();
    expect(settings.emailAlerts).toBe(false);
  });

  it("round-trips a true value through settings storage", async () => {
    const storage = emptyStorage();
    await storage.saveSettings({ ...(await storage.getSettings()), emailAlerts: true });
    expect((await storage.getSettings()).emailAlerts).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/email-alerts-preference.test.ts`
Expected: FAIL (`emailAlerts` undefined)

- [ ] **Step 3: Implement**

In `lib/types.ts`, add to `AppSettings` (after `retentionDays?: number;`):

```ts
  /** Email delivery for alerts (opt-in; default off). Recipient = account email. */
  emailAlerts?: boolean;
```

In `lib/storage/settings.ts`, add to `DEFAULT_SETTINGS` (after `healthAlerts: true,`):

```ts
    emailAlerts: false,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/email-alerts-preference.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/storage/settings.ts tests/email-alerts-preference.test.ts
git commit -m "feat: add emailAlerts setting (default off)"
```

---

## Task 2: `notification_email_log` table

**Files:**
- Modify: `drizzle/schema.ts` (after `notificationEventDeliveries`, ~line 270)
- Test: `tests/email-alerts-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

describe("notification_email_log schema", () => {
  it("exposes the table with the expected columns", async () => {
    const mod = await import("../drizzle/schema");
    expect(mod.notificationEmailLog).toBeDefined();
    expect(mod.notificationEmailLog.userId).toBeDefined();
    expect(mod.notificationEmailLog.dedupKey).toBeDefined();
    expect(mod.notificationEmailLog.sentAt).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/email-alerts-schema.test.ts`
Expected: FAIL (`notificationEmailLog` undefined)

- [ ] **Step 3: Implement**

In `drizzle/schema.ts`, after the `notificationEventDeliveries` table definition, add:

```ts
export const notificationEmailLog = mysqlTable(
  "notification_email_log",
  {
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dedupKey: varchar("dedupKey", { length: 191 }).notNull(),
    sentAt: bigint("sentAt", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.dedupKey] }),
    index("idx_notif_email_sent").on(table.sentAt),
  ],
);
```

Ensure `primaryKey` and `index` are already imported in the file (they are used by other tables).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/email-alerts-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Generate + apply the migration**

Run (test DB; see `scripts/setup-test-db.sh`):
```bash
DATABASE_URL="mysql://promptgen:promptgen@127.0.0.1:3307/stock_tracker_test" pnpm db:push
```
Expected: migration generated and applied; `notification_email_log` exists.

- [ ] **Step 6: Commit**

```bash
git add drizzle/schema.ts drizzle/
git commit -m "feat: add notification_email_log table"
```

---

## Task 3: Unsubscribe token helpers

**Files:**
- Create: `server/notifications/email-alerts.ts`
- Test: `tests/email-alerts-token.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { unsubscribeToken, verifyUnsubscribeToken } from "../server/notifications/email-alerts";

describe("unsubscribe token", () => {
  it("round-trips for the same user", () => {
    const t = unsubscribeToken(42);
    expect(verifyUnsubscribeToken(42, t)).toBe(true);
  });

  it("rejects another user's token", () => {
    expect(verifyUnsubscribeToken(43, unsubscribeToken(42))).toBe(false);
  });

  it("rejects a tampered or wrong-length token", () => {
    const t = unsubscribeToken(42);
    expect(verifyUnsubscribeToken(42, t.slice(0, -1) + (t.endsWith("a") ? "b" : "a"))).toBe(false);
    expect(verifyUnsubscribeToken(42, "short")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/email-alerts-token.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

Create `server/notifications/email-alerts.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "../_core/env";

const TOKEN_LENGTH = 32;

export function unsubscribeToken(userId: number): string {
  return createHmac("sha256", ENV.cookieSecret)
    .update(`email-unsubscribe:${userId}`)
    .digest("hex")
    .slice(0, TOKEN_LENGTH);
}

export function verifyUnsubscribeToken(userId: number, token: string): boolean {
  if (!Number.isInteger(userId) || userId <= 0) return false;
  if (typeof token !== "string" || token.length !== TOKEN_LENGTH) return false;
  const expected = Buffer.from(unsubscribeToken(userId));
  const provided = Buffer.from(token);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/email-alerts-token.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/notifications/email-alerts.ts tests/email-alerts-token.test.ts
git commit -m "feat: signed unsubscribe tokens"
```

---

## Task 4: Email content builder

**Files:**
- Modify: `server/notifications/email-alerts.ts`
- Test: `tests/email-alerts-content.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildAlertEmail } from "../server/notifications/email-alerts";

describe("buildAlertEmail", () => {
  it("includes title, body, product link and unsubscribe link", () => {
    const msg = buildAlertEmail({
      title: "💸 Price Drop Alert!",
      body: "CRS804 is now $420",
      productUrl: "https://app.example.com/product/p1",
      unsubscribeUrl: "https://api.example.com/api/email/unsubscribe?u=1&t=abc",
    });
    expect(msg.subject).toBe("💸 Price Drop Alert!");
    expect(msg.text).toContain("CRS804 is now $420");
    expect(msg.text).toContain("https://app.example.com/product/p1");
    expect(msg.text).toContain("unsubscribe?u=1&t=abc");
    expect(msg.html).toContain("https://app.example.com/product/p1");
    expect(msg.html).toContain("unsubscribe?u=1&t=abc");
  });

  it("omits the product link when there is none", () => {
    const msg = buildAlertEmail({
      title: "T",
      body: "B",
      productUrl: null,
      unsubscribeUrl: "https://api.example.com/api/email/unsubscribe?u=1&t=abc",
    });
    expect(msg.text).not.toContain("View:");
    expect(msg.html).not.toContain("View product");
  });

  it("escapes HTML in the title and body", () => {
    const msg = buildAlertEmail({
      title: "<script>",
      body: "<b>x</b>",
      productUrl: null,
      unsubscribeUrl: "u",
    });
    expect(msg.html).not.toContain("<script>");
    expect(msg.html).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/email-alerts-content.test.ts`
Expected: FAIL (`buildAlertEmail` not exported)

- [ ] **Step 3: Implement**

Append to `server/notifications/email-alerts.ts`:

```ts
import type { EmailMessage } from "../email";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildAlertEmail(opts: {
  title: string;
  body: string;
  productUrl: string | null;
  unsubscribeUrl: string;
}): EmailMessage {
  const { title, body, productUrl, unsubscribeUrl } = opts;
  const textLines = [title, "", body];
  if (productUrl) textLines.push("", `View: ${productUrl}`);
  textLines.push("", `Unsubscribe: ${unsubscribeUrl}`);
  const html =
    `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p>` +
    (productUrl
      ? `<p><a href="${escapeHtml(productUrl)}">View product</a></p>`
      : "") +
    `<p style="font-size:12px;color:#888">` +
    `<a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from email alerts</a></p>`;
  return { to: "", subject: title, html, text: textLines.join("\n") };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/email-alerts-content.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/notifications/email-alerts.ts tests/email-alerts-content.test.ts
git commit -m "feat: alert email content builder"
```

---

## Task 5: Gated delivery (opt-in, idempotency, daily cap)

**Files:**
- Modify: `server/notifications/email-alerts.ts`
- Test: `tests/email-alerts-db.test.ts` (DB-gated)

- [ ] **Step 1: Write the failing DB-gated test**

```ts
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appSettings, notificationEmailLog, users } from "../drizzle/schema";
import { getDb, upsertUser } from "../server/db";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

const sent = vi.hoisted(() => ({ messages: [] as Array<{ to: string; subject: string }> }));
vi.mock("../server/email", () => ({
  isEmailConfigured: () => true,
  sendEmail: vi.fn(async (m: { to: string; subject: string }) => {
    sent.messages.push(m);
    return true;
  }),
}));
import {
  deliverEmailForEvent,
  unsubscribeUser,
} from "../server/notifications/email-alerts";

const ORIGIN = "https://app.example.com";
process.env.EXPO_PUBLIC_WEB_URL = ORIGIN;

async function setEmailAlerts(userId: number, enabled: boolean) {
  const db = await getDb();
  await db!.insert(appSettings).values({
    userId,
    data: { emailAlerts: enabled },
    updatedAtMs: Date.now(),
    clientUpdatedAtMs: Date.now(),
  }).onDuplicateKeyUpdate({
    set: { data: { emailAlerts: enabled }, updatedAtMs: Date.now(), clientUpdatedAtMs: Date.now() },
  });
}

describe.skipIf(!runDbTests)("email alerts delivery (DB)", () => {
  let userId: number;

  beforeEach(async () => {
    const db = await getDb();
    await db!.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const t of ["notification_email_log", "app_settings", "users"]) {
      await db!.execute(sql.raw(`TRUNCATE TABLE ${t}`));
    }
    await db!.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    sent.messages.length = 0;
    await upsertUser({ openId: "email-user", email: "u@example.com" });
    userId = (await db!.select({ id: users.id }).from(users))[0]!.id;
    await setEmailAlerts(userId, true);
  });

  afterEach(() => vi.clearAllMocks());

  it("sends once per condition and ignores reinserts with the same dedupKey", async () => {
    await deliverEmailForEvent(userId, { dedupKey: "k1", title: "Drop", body: "b", productId: null });
    await deliverEmailForEvent(userId, { dedupKey: "k1", title: "Drop", body: "b", productId: null });
    expect(sent.messages).toHaveLength(1);
    expect(sent.messages[0]!.to).toBe("u@example.com");
  });

  it("does not send when the user has not opted in", async () => {
    await setEmailAlerts(userId, false);
    await deliverEmailForEvent(userId, { dedupKey: "k2", title: "T", body: "b", productId: null });
    expect(sent.messages).toHaveLength(0);
  });

  it("enforces a per-user daily cap", async () => {
    for (let i = 0; i < 25; i++) {
      await deliverEmailForEvent(userId, { dedupKey: `cap-${i}`, title: "T", body: "b", productId: null });
    }
    expect(sent.messages).toHaveLength(20);
  });

  it("unsubscribe flips the flag so later events are skipped", async () => {
    const before = await deliverEmailForEvent(userId, { dedupKey: "u0", title: "T", body: "b", productId: null });
    expect(before).toBe(true);
    await unsubscribeUser(userId);
    const after = await deliverEmailForEvent(userId, { dedupKey: "u1", title: "T", body: "b", productId: null });
    expect(after).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL="mysql://promptgen:promptgen@127.0.0.1:3307/stock_tracker_test" RUN_DB_TESTS=1 pnpm vitest run tests/email-alerts-db.test.ts`
Expected: FAIL (`deliverEmailForEvent` not exported)

- [ ] **Step 3: Implement**

Append to `server/notifications/email-alerts.ts`:

```ts
import { and, eq, gte } from "drizzle-orm";
import {
  appSettings,
  notificationEmailLog,
  users,
} from "../../drizzle/schema";
import { affectedRowsOf, getDb } from "../db";
import { isEmailConfigured, sendEmail } from "../email";

const DAILY_CAP = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AlertEmailEvent {
  dedupKey: string;
  title: string;
  body: string;
  productId: string | null;
}

function serverOrigin(): string {
  const raw = (
    process.env.EXPO_PUBLIC_WEB_URL ??
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    ""
  ).trim();
  return raw.replace(/\/+$/, "");
}

function readEmailAlerts(data: unknown): boolean {
  return Boolean(
    data && typeof data === "object" && (data as { emailAlerts?: unknown }).emailAlerts === true,
  );
}

function unsubscribeUrlFor(userId: number, origin: string): string {
  return `${origin}/api/email/unsubscribe?u=${userId}&t=${unsubscribeToken(userId)}`;
}

/**
 * Best-effort email for a fired alert. Returns true only when an email was
 * actually handed to the provider. Never throws.
 */
export async function deliverEmailForEvent(
  userId: number,
  event: AlertEmailEvent,
): Promise<boolean> {
  try {
    if (!isEmailConfigured()) return false;
    const origin = serverOrigin();
    if (!origin) return false;
    const db = await getDb();
    if (!db) return false;

    const settingsRows = await db
      .select({ data: appSettings.data })
      .from(appSettings)
      .where(eq(appSettings.userId, userId))
      .limit(1);
    if (!readEmailAlerts(settingsRows[0]?.data)) return false;

    const userRows = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const email = userRows[0]?.email ?? null;
    if (!email) return false;

    const now = Date.now();
    const recent = await db
      .select({ dedupKey: notificationEmailLog.dedupKey })
      .from(notificationEmailLog)
      .where(
        and(
          eq(notificationEmailLog.userId, userId),
          gte(notificationEmailLog.sentAt, now - DAY_MS),
        ),
      );
    if (recent.length >= DAILY_CAP) return false;

    // Insert-or-ignore on (userId, dedupKey): MySQL returns 1 for a fresh
    // insert and 2 for a no-op update, so affectedRows===1 means "new".
    const insertResult = await db
      .insert(notificationEmailLog)
      .values({ userId, dedupKey: event.dedupKey, sentAt: now })
      .onDuplicateKeyUpdate({ set: { sentAt: notificationEmailLog.sentAt } });
    if (affectedRowsOf(insertResult) !== 1) return false;

    const message = buildAlertEmail({
      title: event.title,
      body: event.body,
      productUrl: event.productId ? `${origin}/product/${event.productId}` : null,
      unsubscribeUrl: unsubscribeUrlFor(userId, origin),
    });
    const ok = await sendEmail({ ...message, to: email });
    if (!ok) {
      // Allow a retry on a later tick; the daily cap bounds hammering.
      await db
        .delete(notificationEmailLog)
        .where(
          and(
            eq(notificationEmailLog.userId, userId),
            eq(notificationEmailLog.dedupKey, event.dedupKey),
          ),
        );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[EmailAlerts] delivery failed", error);
    return false;
  }
}

/** Merge `emailAlerts: false` into the user's settings. Returns false on bad input/no DB. */
export async function unsubscribeUser(userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db || !Number.isInteger(userId) || userId <= 0) return false;
  const rows = await db
    .select({ data: appSettings.data })
    .from(appSettings)
    .where(eq(appSettings.userId, userId))
    .limit(1);
  const current =
    rows[0]?.data && typeof rows[0].data === "object"
      ? (rows[0].data as Record<string, unknown>)
      : {};
  const now = Date.now();
  await db
    .insert(appSettings)
    .values({ userId, data: { ...current, emailAlerts: false }, updatedAtMs: now, clientUpdatedAtMs: now })
    .onDuplicateKeyUpdate({
      set: {
        data: { ...current, emailAlerts: false },
        updatedAtMs: now,
        clientUpdatedAtMs: now,
      },
    });
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `TEST_DATABASE_URL="mysql://promptgen:promptgen@127.0.0.1:3307/stock_tracker_test" RUN_DB_TESTS=1 pnpm vitest run tests/email-alerts-db.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add server/notifications/email-alerts.ts tests/email-alerts-db.test.ts
git commit -m "feat: email alert delivery with opt-in, idempotency and daily cap"
```

---

## Task 6: Hook delivery into the user-event pipeline

**Files:**
- Modify: `server/notifications/evaluate.ts` (the `evaluateUserDb` insert block, ~L481-501)
- Test: `tests/email-alerts-pipeline-db.test.ts` (DB-gated)

- [ ] **Step 1: Write the failing DB-gated test**

Model it on `tests/server-digest-db.test.ts`: bind a device to a user, upload a config with a price alert, seed a cached price, mock `sendEmail`, then run two `evaluateNotifications` ticks and assert exactly one email. Full test:

```ts
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appSettings, users } from "../drizzle/schema";
import { getDb, upsertUser } from "../server/db";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;
process.env.EXPO_PUBLIC_WEB_URL = "https://app.example.com";

const sent = vi.hoisted(() => ({ n: 0 }));
vi.mock("../server/email", () => ({
  isEmailConfigured: () => true,
  sendEmail: vi.fn(async () => {
    sent.n += 1;
    return true;
  }),
}));

import {
  clearNotificationsForTests,
  evaluateNotifications,
  upsertDeviceConfig,
  type NotificationConfig,
} from "../server/notifications";
import { clearPriceCacheForTests, setCachedPrice } from "../server/price-cache";

describe.skipIf(!runDbTests)("email alert pipeline (DB)", () => {
  let userId: number;
  beforeEach(async () => {
    const db = await getDb();
    await db!.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const t of [
      "notification_event_deliveries",
      "notification_events",
      "notification_email_log",
      "device_notification_configs",
      "price_cache",
      "app_settings",
      "users",
    ]) {
      await db!.execute(sql.raw(`TRUNCATE TABLE ${t}`));
    }
    await db!.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    clearNotificationsForTests();
    clearPriceCacheForTests();
    sent.n = 0;
    await upsertUser({ openId: "pipe-user", email: "p@example.com" });
    userId = (await db!.select({ id: users.id }).from(users))[0]!.id;
    await db!.insert(appSettings).values({
      userId,
      data: { emailAlerts: true },
      updatedAtMs: Date.now(),
      clientUpdatedAtMs: Date.now(),
    });
  });

  afterEach(() => vi.clearAllMocks());

  it("emails once for an alert and not again on the next tick", async () => {
    const now = Date.now();
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 400, currency: "USD", stockStatus: "in_stock",
      url: "https://example.com", fetchedAt: now,
    });
    const config: NotificationConfig = {
      alerts: [{ id: "a1", productId: "mikrotik-crs804-4ddq-hrm", targetPrice: 500, currency: "USD" }],
      stockWatches: [],
      dateReminders: [],
    };
    await upsertDeviceConfig("dev-pipe", config, userId);
    await evaluateNotifications(now);
    await evaluateNotifications(now + 60_000);
    expect(sent.n).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL="mysql://promptgen:promptgen@127.0.0.1:3307/stock_tracker_test" RUN_DB_TESTS=1 pnpm vitest run tests/email-alerts-pipeline-db.test.ts`
Expected: FAIL (`sent.n` is 0)

- [ ] **Step 3: Implement**

In `server/notifications/evaluate.ts`, near the top add:

```ts
import { deliverEmailForEvent } from "./email-alerts";
```

In the `evaluateUserDb` block, right after `void sendPushForUser(...)` (around line 498), add a best-effort email per inserted event:

```ts
    for (const event of toInsert) {
      const payload =
        event.payload && typeof event.payload === "object"
          ? (event.payload as { productId?: unknown })
          : null;
      const productId =
        typeof payload?.productId === "string" ? payload.productId : null;
      void deliverEmailForEvent(userId, {
        dedupKey: event.dedupKey,
        title: event.title,
        body: event.body,
        productId,
      }).catch(() => {});
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `TEST_DATABASE_URL="mysql://promptgen:promptgen@127.0.0.1:3307/stock_tracker_test" RUN_DB_TESTS=1 pnpm vitest run tests/email-alerts-pipeline-db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/notifications/evaluate.ts tests/email-alerts-pipeline-db.test.ts
git commit -m "feat: enqueue email after user event insert"
```

---

## Task 7: Public unsubscribe route

**Files:**
- Create: `server/email-unsubscribe-route.ts`
- Modify: `server/_core/index.ts` (import + call after `registerOAuthRoutes(app);`)
- Test: `tests/email-unsubscribe-route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";

const unsubscribeUser = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../server/notifications/email-alerts", () => ({
  verifyUnsubscribeToken: (id: number, t: string) => t === `tok-${id}`,
  unsubscribeUser,
}));

import { registerUnsubscribeRoute } from "../server/email-unsubscribe-route";

function serve() {
  const app = express();
  registerUnsubscribeRoute(app);
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  return {
    fetch: (p: string) => fetch(`http://127.0.0.1:${port}${p}`),
    close: () => server.close(),
  };
}

describe("GET /api/email/unsubscribe", () => {
  it("flips the flag and confirms for a valid token", async () => {
    const s = serve();
    try {
      const res = await s.fetch(`/api/email/unsubscribe?u=7&t=tok-7`);
      expect(res.status).toBe(200);
      expect(await res.text()).toMatch(/unsubscribed/i);
      expect(unsubscribeUser).toHaveBeenCalledWith(7);
    } finally {
      s.close();
    }
  });

  it("rejects an invalid token", async () => {
    const s = serve();
    try {
      const res = await s.fetch(`/api/email/unsubscribe?u=7&t=bad`);
      expect(res.status).toBe(400);
      expect(unsubscribeUser).not.toHaveBeenCalled();
    } finally {
      s.close();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/email-unsubscribe-route.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement the isolated route module**

Create `server/email-unsubscribe-route.ts`:

```ts
import type { Express, Request } from "express";
import { checkRateLimitByKey } from "./rate-limit";

function clientIp(req: Request): string {
  return (
    req.ip ??
    (req.socket && req.socket.remoteAddress) ??
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ??
    "unknown"
  );
}

export function registerUnsubscribeRoute(app: Express): void {
  app.get("/api/email/unsubscribe", async (req, res) => {
    checkRateLimitByKey(`email.unsubscribe:${clientIp(req)}`, 30, 60_000);
    const { verifyUnsubscribeToken, unsubscribeUser } = await import(
      "./notifications/email-alerts"
    );
    const userId = Number(req.query.u);
    const token = String(req.query.t ?? "");
    if (!verifyUnsubscribeToken(userId, token)) {
      res.status(400).type("html").send("<h1>Invalid link</h1>");
      return;
    }
    await unsubscribeUser(userId);
    res
      .status(200)
      .type("html")
      .send(
        "<h1>Unsubscribed</h1><p>You will no longer receive alert emails.</p>",
      );
  });
}
```

- [ ] **Step 4: Wire it into the server**

In `server/_core/index.ts`, add near the other imports:
```ts
import { registerUnsubscribeRoute } from "../email-unsubscribe-route";
```
and after `registerOAuthRoutes(app);` add:
```ts
  registerUnsubscribeRoute(app);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/email-unsubscribe-route.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/email-unsubscribe-route.ts server/_core/index.ts tests/email-unsubscribe-route.test.ts
git commit -m "feat: public email unsubscribe route"
```

---

## Task 8: Mobile settings toggle

**Files:**
- Modify: `components/settings/notifications-section.tsx` (add a `SettingRow` after "Health Alerts", ~L181)
- Test: `tests/email-alerts-ui.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("email alerts settings UI", () => {
  it("exposes an Email Alerts switch bound to emailAlerts", () => {
    const mobile = readFileSync("components/settings/notifications-section.tsx", "utf8");
    expect(mobile).toContain("Email Alerts");
    expect(mobile).toContain('updateSetting("emailAlerts"');
    const desktop = readFileSync("desktop/src/pages/Settings.tsx", "utf8");
    expect(desktop).toContain("Email Alerts");
    expect(desktop).toContain("emailAlerts");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/email-alerts-ui.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

In `components/settings/notifications-section.tsx`, after the Health Alerts `SettingRow` (before the Price Digest `View`), add:

```tsx
        <SettingRow
          icon="envelope.fill"
          label="Email Alerts"
          description="Email me when an alert fires"
          right={
            <Switch
              value={!!settings.emailAlerts}
              onValueChange={(v) => updateSetting("emailAlerts", v)}
              trackColor={{
                false: colors.border,
                true: colors.primary + "88",
              }}
              thumbColor={settings.emailAlerts ? colors.primary : colors.muted}
              accessibilityLabel="Enable email alerts"
              accessibilityRole="switch"
            />
          }
        />
```

- [ ] **Step 4: Confirm the icon mapping exists**

Run: `grep -n '"envelope.fill"' components/ui/icon-symbol.tsx`
Expected: `"envelope.fill": "mail"` (already present — no change needed).

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/email-alerts-ui.test.ts`
Expected: PASS (mobile half)

- [ ] **Step 6: Commit**

```bash
git add components/settings/notifications-section.tsx tests/email-alerts-ui.test.ts
git commit -m "feat: mobile email alerts toggle"
```

---

## Task 9: Desktop settings toggle

**Files:**
- Modify: `desktop/src/pages/Settings.tsx` (Notifications section, near the Health Alerts checkbox ~L1719)
- Test: same `tests/email-alerts-ui.test.ts` (desktop assertion already added in Task 8)

- [ ] **Step 1: Locate the Health Alerts block**

Run: `grep -n "Health Alerts" desktop/src/pages/Settings.tsx`
Expected: a label block with a checkbox calling `update({ healthAlerts: ... })`.

- [ ] **Step 2: Implement**

Immediately after the Health Alerts `</label>`, add:

```tsx
          <label className={`flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-3 py-2.5 rounded-lg transition-colors ${settings.notificationsEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
            <span>
              <span className="block text-sm font-medium">Email Alerts</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">Email me when an alert fires</span>
            </span>
            <span className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!settings.emailAlerts}
                onChange={(e) => update({ emailAlerts: e.target.checked })}
                disabled={!settings.notificationsEnabled}
                className="sr-only peer"
                aria-label="Enable email alerts"
              />
              <span className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-300 dark:peer-focus:ring-brand-800 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:after:translate-x-full peer-checked:after:border-white transition-colors duration-300" />
            </span>
          </label>
```

- [ ] **Step 3: Run test to verify it passes**

Run: `pnpm vitest run tests/email-alerts-ui.test.ts`
Expected: PASS

- [ ] **Step 4: Typecheck the desktop**

Run: `pnpm check:desktop`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Settings.tsx
git commit -m "feat: desktop email alerts toggle"
```

---

## Task 10: Full verification + docs

**Files:**
- Modify: `todo.md`

- [ ] **Step 1: Run the full offline suite**

Run: `pnpm check && pnpm lint && pnpm test`
Expected: `tsc` 0 errors, lint 0 errors, all tests pass (DB-gated files skip).

- [ ] **Step 2: Run the DB suite**

Run: `TEST_DATABASE_URL="mysql://promptgen:promptgen@127.0.0.1:3307/stock_tracker_test" RUN_DB_TESTS=1 pnpm test:db`
Expected: all DB-gated tests pass, including the new email-alert ones.

- [ ] **Step 3: Desktop check**

Run: `pnpm check:desktop && pnpm --dir desktop test`
Expected: 0 errors, all pass.

- [ ] **Step 4: Append the phase entry to `todo.md`**

```md
## Phase 1018: Email alerts (opt-in, server-evaluated)

- [x] `AppSettings.emailAlerts` (default off) with mobile + desktop toggles.
- [x] `notification_email_log` (userId, dedupKey, sentAt) for once-per-condition idempotency.
- [x] `server/notifications/email-alerts.ts`: signed unsubscribe token, content builder, opt-in + daily-cap gated delivery, unsubscribe merge.
- [x] Hook after user-event insert in `evaluate.ts`; public `GET /api/email/unsubscribe`.
- [x] Tests: token/content unit, DB delivery/cap/unsubscribe, pipeline integration, route, UI source guard.
- [x] `tsc 0`, lint 0 errors, offline + DB suites green; desktop green.
```

- [ ] **Step 5: Commit**

```bash
git add todo.md
git commit -m "Docs: email alerts phase entry (Phase 1018)"
```

---

## Follow-up (separate cycle): Bulk-import discovery

Not part of this plan. When picked up, it needs its own spec → plan: discover listings for products added via `components/search/bulk-import-modal.tsx` / `app/search.tsx` bulk paths with a capped/queued policy and a repair CTA for `listings: []` products.
