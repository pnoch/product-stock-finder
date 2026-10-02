# Webhook Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** POST a Discord/Slack message when one of a user's alerts fires, server-evaluated and immediate, opt-in via a Webhook URL setting.

**Architecture:** Mirror the email-alerts channel. `evaluateNotifications` evaluates every bound user each warmer tick; after a user-scoped `notificationEvents` row is inserted, best-effort POST to the user's webhook. Idempotency is keyed by `(userId, dedupKey)` in a new `notification_webhook_log` table, and a per-user daily cap bounds delivery. The user-supplied URL is validated against a strict Discord/Slack host allowlist (SSRF guard) for both real and test sends.

**Tech Stack:** TypeScript, Express, tRPC, Drizzle (MySQL), Vitest, React Native/Expo (mobile), React (desktop), global `fetch` + AbortController.

**Spec:** `docs/superpowers/specs/2026-10-02-webhook-alerts-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `lib/types.ts` | `AppSettings.webhookAlerts` + `alertWebhookUrl` |
| `lib/storage/settings.ts` | default `webhookAlerts: false`, `alertWebhookUrl: ""` |
| `drizzle/schema.ts` | `notificationWebhookLog` table |
| `server/notifications/webhook-alerts.ts` | URL classify, payload/text builders, post, gated delivery, test send, purge |
| `server/notifications/evaluate.ts` | enqueue webhook after the email loop |
| `server/routers.ts` | `notifications.testWebhook` |
| `server/prices.ts` | run `purgeOldWebhookLog` in the warmer |
| `lib/server-notifications.ts` | mobile imperative `testWebhook` wrapper |
| `components/settings/notifications-section.tsx` | mobile config UI |
| `desktop/src/pages/Settings.tsx` | desktop config UI |
| tests | unit + DB-gated + pipeline + endpoint + UI guards |

**Note on column width:** the spec said `varchar(191)`; the existing `notification_email_log` uses `varchar(255)`. This plan uses **255** for consistency with the shipped email table.

---

## Task 1: Preference type + default

**Files:**
- Modify: `lib/types.ts` (inside `AppSettings`, after `emailAlerts?: boolean;`)
- Modify: `lib/storage/settings.ts` (inside `DEFAULT_SETTINGS`, after `emailAlerts: false,`)
- Modify: `lib/backup.ts` (inside `SETTING_DEFAULTS`, after `emailAlerts: false,`)
- Test: `tests/webhook-alerts-preference.test.ts`

**Why `lib/backup.ts`:** a field in `DEFAULT_SETTINGS` but not `SETTING_DEFAULTS` is always taken from a backup, silently overwriting the local value with the exporter's default. `tests/backup.test.ts` ("SETTING_DEFAULTS coverage") pins this. The email-alerts phase fixed the analogous miss in a follow-up commit.

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

describe("webhookAlerts preference default", () => {
  it("defaults to false and an empty URL when unset", async () => {
    const settings = await emptyStorage().getSettings();
    expect(settings.webhookAlerts).toBe(false);
    expect(settings.alertWebhookUrl).toBe("");
  });

  it("round-trips enabled + URL through settings storage", async () => {
    const storage = emptyStorage();
    const base = await storage.getSettings();
    await storage.saveSettings({
      ...base,
      webhookAlerts: true,
      alertWebhookUrl: "https://discord.com/api/webhooks/1/x",
    });
    const settings = await storage.getSettings();
    expect(settings.webhookAlerts).toBe(true);
    expect(settings.alertWebhookUrl).toBe("https://discord.com/api/webhooks/1/x");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/webhook-alerts-preference.test.ts`
Expected: FAIL (`settings.webhookAlerts` is `undefined`)

- [ ] **Step 3: Implement**

In `lib/types.ts`, inside `AppSettings` after the `emailAlerts` field, add:

```ts
  /** Webhook delivery for alerts (opt-in; default off). */
  webhookAlerts?: boolean;
  /** Discord/Slack incoming webhook URL. */
  alertWebhookUrl?: string;
```

In `lib/storage/settings.ts`, inside `DEFAULT_SETTINGS` after `emailAlerts: false,`, add:

```ts
    webhookAlerts: false,
    alertWebhookUrl: "",
```

In `lib/backup.ts`, inside `SETTING_DEFAULTS` after `emailAlerts: false,`, add the same two entries:

```ts
  webhookAlerts: false,
  alertWebhookUrl: "",
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/webhook-alerts-preference.test.ts tests/backup.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/storage/settings.ts lib/backup.ts tests/webhook-alerts-preference.test.ts
git commit -m "feat: add webhookAlerts settings (default off)"
```

---

## Task 2: `notification_webhook_log` table

**Files:**
- Modify: `drizzle/schema.ts` (after `notificationEmailLog`, ~line 286)
- Test: `tests/webhook-alerts-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

describe("notification_webhook_log schema", () => {
  it("exposes the table with the expected columns", async () => {
    const mod = await import("../drizzle/schema");
    expect(mod.notificationWebhookLog).toBeDefined();
    expect(mod.notificationWebhookLog.userId).toBeDefined();
    expect(mod.notificationWebhookLog.dedupKey).toBeDefined();
    expect(mod.notificationWebhookLog.sentAt).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/webhook-alerts-schema.test.ts`
Expected: FAIL (`notificationWebhookLog` undefined)

- [ ] **Step 3: Implement**

In `drizzle/schema.ts`, after the `notificationEmailLog` block (line 286) add:

```ts
export const notificationWebhookLog = mysqlTable(
  "notification_webhook_log",
  {
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dedupKey: varchar("dedupKey", { length: 255 }).notNull(),
    sentAt: bigint("sentAt", { mode: "number" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.dedupKey] }),
    index("idx_notif_webhook_user_sent").on(table.userId, table.sentAt),
    index("idx_notif_webhook_sent").on(table.sentAt),
  ],
);

export type NotificationWebhookLogRow =
  typeof notificationWebhookLog.$inferSelect;
export type InsertNotificationWebhookLogRow =
  typeof notificationWebhookLog.$inferInsert;
```

`primaryKey`, `index`, `mysqlTable`, `int`, `varchar`, `bigint` are already imported/used by neighbouring tables.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/webhook-alerts-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Generate + apply the migration**

Run (test DB; see `scripts/setup-test-db.sh`):
```bash
DATABASE_URL="mysql://promptgen:promptgen@127.0.0.1:3307/stock_tracker_test" pnpm db:push
```
Expected: migration generated and applied; `notification_webhook_log` exists.

- [ ] **Step 6: Commit**

```bash
git add drizzle/schema.ts drizzle/
git commit -m "feat: add notification_webhook_log table"
```

---

## Task 3: URL classification, payload/text builders, post

**Files:**
- Create: `server/notifications/webhook-alerts.ts`
- Test: `tests/webhook-alerts-unit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildWebhookPayload,
  buildWebhookText,
  classifyWebhookUrl,
  postWebhook,
} from "../server/notifications/webhook-alerts";

afterEach(() => vi.unstubAllGlobals());

describe("classifyWebhookUrl", () => {
  it("accepts Discord hosts and subdomains", () => {
    expect(classifyWebhookUrl("https://discord.com/api/webhooks/1/x")?.provider).toBe("discord");
    expect(classifyWebhookUrl("https://discordapp.com/api/webhooks/1/x")?.provider).toBe("discord");
    expect(classifyWebhookUrl("https://ptb.discord.com/api/webhooks/1/x")?.provider).toBe("discord");
  });

  it("accepts the Slack incoming-webhook host", () => {
    expect(classifyWebhookUrl("https://hooks.slack.com/services/T/B/x")?.provider).toBe("slack");
  });

  it("rejects http, unknown hosts, and host-spoofs", () => {
    expect(classifyWebhookUrl("http://discord.com/api/webhooks/1/x")).toBeNull();
    expect(classifyWebhookUrl("https://evil.com/x")).toBeNull();
    expect(classifyWebhookUrl("https://discord.com.evil.com/x")).toBeNull();
    expect(classifyWebhookUrl("https://xdiscord.com/x")).toBeNull();
    expect(classifyWebhookUrl("not a url")).toBeNull();
    expect(classifyWebhookUrl("")).toBeNull();
  });
});

describe("buildWebhookPayload", () => {
  it("uses `content` + no-parse mentions for Discord", () => {
    expect(buildWebhookPayload("discord", "hi")).toEqual({
      content: "hi",
      allowed_mentions: { parse: [] },
    });
  });

  it("uses `text` for Slack", () => {
    expect(buildWebhookPayload("slack", "hi")).toEqual({ text: "hi" });
  });

  it("neutralizes mention syntax", () => {
    const discord = buildWebhookPayload("discord", "@everyone <@123> <!channel>") as {
      content: string;
    };
    expect(discord.content).not.toContain("@everyone");
    expect(discord.content).not.toContain("<@123>");
    expect(discord.content).not.toContain("<!channel>");
    expect(discord.content).toContain("[mention]");
  });
});

describe("buildWebhookText", () => {
  it("includes the product link and the manage line", () => {
    const text = buildWebhookText({
      title: "Drop",
      body: "CRS804 is $420",
      productUrl: "https://app.example.com/product/p1",
    });
    expect(text).toContain("https://app.example.com/product/p1");
    expect(text).toContain("Manage alerts");
  });

  it("omits the product link when null", () => {
    const text = buildWebhookText({ title: "T", body: "B", productUrl: null });
    expect(text).not.toContain("http");
  });
});

describe("postWebhook", () => {
  it("returns true on a 2xx", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await postWebhook("slack", "https://hooks.slack.com/services/T/B/x", "hi")).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("returns false on a non-2xx or a network error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    expect(await postWebhook("discord", "https://discord.com/api/webhooks/1/x", "hi")).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("down"))));
    expect(await postWebhook("discord", "https://discord.com/api/webhooks/1/x", "hi")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/webhook-alerts-unit.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

Create `server/notifications/webhook-alerts.ts`:

```ts
const FETCH_TIMEOUT_MS = 5_000;

export type WebhookProvider = "discord" | "slack";

export interface WebhookTarget {
  provider: WebhookProvider;
  url: string;
}

/**
 * Validates a user-supplied webhook URL against the Discord/Slack allowlist.
 * The returned provider selects the payload shape. This is the entire SSRF
 * surface: only these hosts are ever fetched by the server.
 */
export function classifyWebhookUrl(raw: unknown): WebhookTarget | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  if (host === "hooks.slack.com") {
    return { provider: "slack", url: parsed.toString() };
  }
  if (
    host === "discord.com" ||
    host === "discordapp.com" ||
    host.endsWith(".discord.com") ||
    host.endsWith(".discordapp.com")
  ) {
    return { provider: "discord", url: parsed.toString() };
  }
  return null;
}

/**
 * Neutralizes mention syntax so a product name or alert body can never ping a
 * channel. Slack parses `text` as mrkdwn and Discord would honour `<@id>` even
 * with allowed_mentions disabled; inserting a zero-width space after `@` and
 * rewriting the mention tags removes both.
 */
function neutralizeMentions(text: string): string {
  return text
    .replace(/@everyone/gi, "@\u200beveryone")
    .replace(/@here/gi, "@\u200bhere")
    .replace(/<@[!&]?\d+>/g, "[mention]")
    .replace(/<!(\w+)>/g, "[$1]");
}

export function buildWebhookPayload(
  provider: WebhookProvider,
  text: string,
): Record<string, unknown> {
  const safe = neutralizeMentions(text);
  if (provider === "slack") return { text: safe };
  return { content: safe, allowed_mentions: { parse: [] } };
}

export function buildWebhookText(opts: {
  title: string;
  body: string;
  productUrl: string | null;
}): string {
  const lines = [opts.title, opts.body].filter((l) => l.trim().length > 0);
  if (opts.productUrl) lines.push(opts.productUrl);
  lines.push("Manage alerts in Product Stock Finder settings.");
  return lines.join("\n");
}

/** POSTs a webhook message. Returns true only on a 2xx; never throws. */
export async function postWebhook(
  provider: WebhookProvider,
  url: string,
  text: string,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildWebhookPayload(provider, text)),
      signal: controller.signal,
    });
    return res.ok;
  } catch (error) {
    console.warn("[WebhookAlerts] post failed", error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Validates and sends a fixed test message. Used by the Settings test button. */
export async function sendTestWebhook(
  url: string,
): Promise<{ ok: boolean; error?: string }> {
  const target = classifyWebhookUrl(url);
  if (!target) {
    return { ok: false, error: "Enter a valid Discord or Slack webhook URL." };
  }
  const ok = await postWebhook(
    target.provider,
    target.url,
    "Test alert from Product Stock Finder - your webhook is configured correctly.",
  );
  return ok
    ? { ok: true }
    : { ok: false, error: "The webhook did not accept the test message." };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/webhook-alerts-unit.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/notifications/webhook-alerts.ts tests/webhook-alerts-unit.test.ts
git commit -m "feat: webhook URL classify, payload and test send"
```

---

## Task 4: Gated delivery (opt-in, idempotency, daily cap) + purge

**Files:**
- Modify: `server/notifications/webhook-alerts.ts` (append)
- Modify: `server/prices.ts:268` (warmer step)
- Test: `tests/webhook-alerts-db.test.ts` (DB-gated)

- [ ] **Step 1: Write the failing DB-gated test**

```ts
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appSettings, users } from "../drizzle/schema";
import { getDb, upsertUser } from "../server/db";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
vi.stubGlobal("fetch", fetchMock);

import { deliverWebhookForEvent } from "../server/notifications/webhook-alerts";

async function setWebhookConfig(userId: number, enabled: boolean, url: string) {
  const db = await getDb();
  await db!
    .insert(appSettings)
    .values({
      userId,
      data: { webhookAlerts: enabled, alertWebhookUrl: url },
      updatedAtMs: Date.now(),
      clientUpdatedAtMs: Date.now(),
    })
    .onDuplicateKeyUpdate({
      set: {
        data: { webhookAlerts: enabled, alertWebhookUrl: url },
        updatedAtMs: Date.now(),
        clientUpdatedAtMs: Date.now(),
      },
    });
}

const VALID_URL = "https://discord.com/api/webhooks/1/x";

describe.skipIf(!runDbTests)("webhook alerts delivery (DB)", () => {
  let userId: number;

  beforeEach(async () => {
    const db = await getDb();
    await db!.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const t of ["notification_webhook_log", "app_settings", "users"]) {
      await db!.execute(sql.raw(`TRUNCATE TABLE ${t}`));
    }
    await db!.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await upsertUser({ openId: "webhook-user", email: "w@example.com" });
    userId = (await db!.select({ id: users.id }).from(users))[0]!.id;
    await setWebhookConfig(userId, true, VALID_URL);
  });

  afterEach(() => vi.clearAllMocks());

  it("sends once per condition and ignores reinserts with the same dedupKey", async () => {
    const event = { dedupKey: "k1", title: "Drop", body: "b", productId: null };
    await deliverWebhookForEvent(userId, event);
    await deliverWebhookForEvent(userId, event);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not send when the user has not opted in", async () => {
    await setWebhookConfig(userId, false, VALID_URL);
    await deliverWebhookForEvent(userId, { dedupKey: "k2", title: "T", body: "b", productId: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips an unallowlisted URL without claiming the condition", async () => {
    await setWebhookConfig(userId, true, "https://evil.com/x");
    await deliverWebhookForEvent(userId, { dedupKey: "k3", title: "T", body: "b", productId: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enforces a per-user daily cap", async () => {
    for (let i = 0; i < 25; i++) {
      await deliverWebhookForEvent(userId, { dedupKey: `cap-${i}`, title: "T", body: "b", productId: null });
    }
    expect(fetchMock).toHaveBeenCalledTimes(20);
  });

  it("keeps the claim on a non-2xx so the same condition is not retried", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    const event = { dedupKey: "fail", title: "T", body: "b", productId: null };
    await deliverWebhookForEvent(userId, event);
    await deliverWebhookForEvent(userId, event);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL="mysql://promptgen:promptgen@127.0.0.1:3307/stock_tracker_test" RUN_DB_TESTS=1 pnpm vitest run tests/webhook-alerts-db.test.ts`
Expected: FAIL (`deliverWebhookForEvent` not exported)

- [ ] **Step 3: Implement**

Append to `server/notifications/webhook-alerts.ts`. Add imports at the top of the file:

```ts
import { and, eq, gte, lt } from "drizzle-orm";
import { appSettings, notificationWebhookLog } from "../../drizzle/schema";
import { affectedRowsOf, getDb } from "../db";
```

Then append:

```ts
const DAILY_CAP = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEBHOOK_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export interface AlertWebhookEvent {
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

function readWebhookConfig(data: unknown): { enabled: boolean; url: string } {
  if (!data || typeof data !== "object") return { enabled: false, url: "" };
  const d = data as { webhookAlerts?: unknown; alertWebhookUrl?: unknown };
  return {
    enabled: d.webhookAlerts === true,
    url: typeof d.alertWebhookUrl === "string" ? d.alertWebhookUrl : "",
  };
}

/**
 * Best-effort webhook for a fired alert. Returns true only when the provider
 * accepted the POST. Never throws. The claim row is written before the send so
 * a failure (non-2xx/timeout) still counts toward DAILY_CAP and the condition
 * is not retried.
 */
export async function deliverWebhookForEvent(
  userId: number,
  event: AlertWebhookEvent,
): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    const settingsRows = await db
      .select({ data: appSettings.data })
      .from(appSettings)
      .where(eq(appSettings.userId, userId))
      .limit(1);
    const config = readWebhookConfig(settingsRows[0]?.data);
    if (!config.enabled) return false;
    const target = classifyWebhookUrl(config.url);
    if (!target) return false;

    const now = Date.now();
    const recent = await db
      .select({ dedupKey: notificationWebhookLog.dedupKey })
      .from(notificationWebhookLog)
      .where(
        and(
          eq(notificationWebhookLog.userId, userId),
          gte(notificationWebhookLog.sentAt, now - DAY_MS),
        ),
      );
    if (recent.length >= DAILY_CAP) return false;

    // INSERT IGNORE: affectedRows 1 for a fresh insert, 0 for a duplicate.
    const insertResult = await db
      .insert(notificationWebhookLog)
      .ignore()
      .values({ userId, dedupKey: event.dedupKey, sentAt: now });
    if (affectedRowsOf(insertResult) !== 1) return false;

    const origin = serverOrigin();
    const text = buildWebhookText({
      title: event.title,
      body: event.body,
      productUrl:
        event.productId && origin ? `${origin}/product/${event.productId}` : null,
    });
    return await postWebhook(target.provider, target.url, text);
  } catch (error) {
    console.warn("[WebhookAlerts] delivery failed", error);
    return false;
  }
}

export async function purgeOldWebhookLog(now: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(notificationWebhookLog)
    .where(lt(notificationWebhookLog.sentAt, now - WEBHOOK_LOG_RETENTION_MS));
}
```

- [ ] **Step 4: Wire the purge into the warmer**

In `server/prices.ts`, near the `purgeOldEmailLog` import (line 24) add:

```ts
import { purgeOldWebhookLog } from "./notifications/webhook-alerts";
```

and immediately after the `purgeOldEmailLog` warmer step (line 268) add:

```ts
    await warmerStep("purgeOldWebhookLog", () =>
      purgeOldWebhookLog(Date.now()),
    );
```

- [ ] **Step 5: Run test to verify it passes**

Run: `TEST_DATABASE_URL="mysql://promptgen:promptgen@127.0.0.1:3307/stock_tracker_test" RUN_DB_TESTS=1 pnpm vitest run tests/webhook-alerts-db.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add server/notifications/webhook-alerts.ts server/prices.ts tests/webhook-alerts-db.test.ts
git commit -m "feat: webhook alert delivery with opt-in, idempotency and daily cap"
```

---

## Task 5: Hook delivery into the user-event pipeline

**Files:**
- Modify: `server/notifications/evaluate.ts:10` (import) and `:503-518` (the post-insert loop)
- Test: `tests/webhook-alerts-pipeline-db.test.ts` (DB-gated)

- [ ] **Step 1: Write the failing DB-gated test**

```ts
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appSettings, users } from "../drizzle/schema";
import { getDb, upsertUser } from "../server/db";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;
process.env.EXPO_PUBLIC_WEB_URL = "https://app.example.com";

const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
vi.stubGlobal("fetch", fetchMock);

import {
  clearNotificationsForTests,
  evaluateNotifications,
  upsertDeviceConfig,
  type NotificationConfig,
} from "../server/notifications";
import { clearPriceCacheForTests, setCachedPrice } from "../server/price-cache";

describe.skipIf(!runDbTests)("webhook alert pipeline (DB)", () => {
  let userId: number;

  beforeEach(async () => {
    const db = await getDb();
    await db!.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const t of [
      "notification_event_deliveries",
      "notification_events",
      "notification_webhook_log",
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
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await upsertUser({ openId: "pipe-webhook-user", email: "pw@example.com" });
    userId = (await db!.select({ id: users.id }).from(users))[0]!.id;
    await db!.insert(appSettings).values({
      userId,
      data: {
        webhookAlerts: true,
        alertWebhookUrl: "https://discord.com/api/webhooks/1/x",
      },
      updatedAtMs: Date.now(),
      clientUpdatedAtMs: Date.now(),
    });
  });

  afterEach(() => vi.clearAllMocks());

  it("posts once for an alert and not again on the next tick", async () => {
    const now = Date.now();
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 400,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: now,
    });
    const config: NotificationConfig = {
      alerts: [
        {
          id: "a1",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
      stockWatches: [],
      dateReminders: [],
    };
    await upsertDeviceConfig("dev-pipe-webhook", config, userId);
    await evaluateNotifications(now);
    await evaluateNotifications(now + 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL="mysql://promptgen:promptgen@127.0.0.1:3307/stock_tracker_test" RUN_DB_TESTS=1 pnpm vitest run tests/webhook-alerts-pipeline-db.test.ts`
Expected: FAIL (`fetchMock` called 0 times)

- [ ] **Step 3: Implement**

In `server/notifications/evaluate.ts`, next to the email import (line 10) add:

```ts
import { deliverWebhookForEvent } from "./webhook-alerts";
```

In the post-insert loop (currently lines 503-518), add the webhook delivery after the email call:

```ts
    void (async () => {
      for (const event of toInsert) {
        const payload =
          event.payload && typeof event.payload === "object"
            ? (event.payload as { productId?: unknown })
            : null;
        const productId =
          typeof payload?.productId === "string" ? payload.productId : null;
        await deliverEmailForEvent(userId, {
          dedupKey: event.dedupKey,
          title: event.title,
          body: event.body,
          productId,
        });
        await deliverWebhookForEvent(userId, {
          dedupKey: event.dedupKey,
          title: event.title,
          body: event.body,
          productId,
        });
      }
    })().catch(() => {});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `TEST_DATABASE_URL="mysql://promptgen:promptgen@127.0.0.1:3307/stock_tracker_test" RUN_DB_TESTS=1 pnpm vitest run tests/webhook-alerts-pipeline-db.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/notifications/evaluate.ts tests/webhook-alerts-pipeline-db.test.ts
git commit -m "feat: enqueue webhook after user event insert"
```

---

## Task 6: `notifications.testWebhook` endpoint + client wrappers

**Files:**
- Modify: `server/routers.ts` (notifications router, after `unregisterPushToken`, ~line 644)
- Modify: `lib/server-notifications.ts` (append wrapper)
- Test: `tests/webhook-alerts-router.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const sendTestWebhook = vi.hoisted(() => vi.fn());
vi.mock("../server/notifications/webhook-alerts", () => ({ sendTestWebhook }));

function authedContext(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "open-7",
      name: null,
      email: null,
      loginMethod: null,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as TrpcContext["user"],
    req: { protocol: "https", hostname: "localhost", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
    deviceId: "test-device",
  };
}

describe("notifications.testWebhook", () => {
  it("delegates to sendTestWebhook and returns its result", async () => {
    sendTestWebhook.mockResolvedValueOnce({ ok: true });
    const caller = appRouter.createCaller(authedContext());
    await expect(
      caller.notifications.testWebhook({ url: "https://discord.com/api/webhooks/1/x" }),
    ).resolves.toEqual({ ok: true });
    expect(sendTestWebhook).toHaveBeenCalledWith("https://discord.com/api/webhooks/1/x");
  });

  it("passes through a validation error", async () => {
    sendTestWebhook.mockResolvedValueOnce({ ok: false, error: "bad" });
    const caller = appRouter.createCaller(authedContext());
    await expect(
      caller.notifications.testWebhook({ url: "https://evil.com/x" }),
    ).resolves.toEqual({ ok: false, error: "bad" });
  });

  it("rejects an unauthenticated caller", async () => {
    const ctx = { ...authedContext(), user: null } as TrpcContext;
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.notifications.testWebhook({ url: "https://discord.com/api/webhooks/1/x" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/webhook-alerts-router.test.ts`
Expected: FAIL (`testWebhook` is not a function)

- [ ] **Step 3: Implement the router procedure**

In `server/routers.ts`, inside the `notifications: router({ ... })` block, after `unregisterPushToken` (line 644, before the closing `}),`), add:

```ts
    testWebhook: protectedProcedure
      .input(z.object({ url: z.string().min(1).max(2048) }))
      .mutation(async ({ input, ctx }) => {
        checkRateLimit(ctx, "notifications.testWebhook", 5, 60_000);
        const { sendTestWebhook } = await import("./notifications/webhook-alerts");
        return sendTestWebhook(input.url);
      }),
```

- [ ] **Step 4: Implement the mobile client wrapper**

Append to `lib/server-notifications.ts`:

```ts
export async function testWebhook(
  url: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = createTRPCClient();
    return await withTimeout(
      client.notifications.testWebhook.mutate({ url }),
      TIMEOUT_MS,
    );
  } catch {
    return { ok: false, error: "Could not reach the server. Try again." };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/webhook-alerts-router.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add server/routers.ts lib/server-notifications.ts tests/webhook-alerts-router.test.ts
git commit -m "feat: notifications.testWebhook endpoint + mobile wrapper"
```

---

## Task 7: Mobile settings UI

**Files:**
- Modify: `components/settings/notifications-section.tsx` (after the Email Alerts `SettingRow`, ~line 199)
- Test: `tests/webhook-alerts-ui.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("webhook alerts settings UI", () => {
  it("exposes URL input, enable toggle and test button on mobile", () => {
    const mobile = readFileSync("components/settings/notifications-section.tsx", "utf8");
    expect(mobile).toContain("Webhook Alerts");
    expect(mobile).toContain('updateSetting("alertWebhookUrl"');
    expect(mobile).toContain('updateSetting("webhookAlerts"');
    expect(mobile).toContain("Send test");
    expect(mobile).toContain("testWebhook");
  });

  it("exposes the same affordances on desktop", () => {
    const desktop = readFileSync("desktop/src/pages/Settings.tsx", "utf8");
    expect(desktop).toContain("Webhook Alerts");
    expect(desktop).toContain("alertWebhookUrl");
    expect(desktop).toContain("testWebhook");
    expect(desktop).toContain("Send test");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/webhook-alerts-ui.test.ts`
Expected: FAIL (mobile half)

- [ ] **Step 3: Implement**

In `components/settings/notifications-section.tsx`, update the React Native import to include `TextInput` and `TouchableOpacity`:

```tsx
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
} from "react-native";
```

Add to the React import at the very top of the file:

```tsx
import { useEffect, useState } from "react";
```

Add `useAuth` next to the other `@/` imports:

```tsx
import { useAuth } from "@/hooks/use-auth";
```

Inside the component, after `const colors = useColors();`, add:

```tsx
  const { isAuthenticated } = useAuth();
  const [webhookUrl, setWebhookUrl] = useState(settings.alertWebhookUrl ?? "");
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookHint, setWebhookHint] = useState<string | null>(null);
  const [webhookHintOk, setWebhookHintOk] = useState(false);

  useEffect(() => {
    setWebhookUrl(settings.alertWebhookUrl ?? "");
  }, [settings.alertWebhookUrl]);

  const commitWebhookUrl = () => {
    const next = webhookUrl.trim();
    if (next !== (settings.alertWebhookUrl ?? "")) {
      updateSetting("alertWebhookUrl", next);
    }
  };

  const handleTestWebhook = async () => {
    const url = webhookUrl.trim();
    if (!url) {
      setWebhookHintOk(false);
      setWebhookHint("Enter a webhook URL first.");
      return;
    }
    setTestingWebhook(true);
    setWebhookHint(null);
    try {
      const { testWebhook } = await import("@/lib/server-notifications");
      const result = await testWebhook(url);
      setWebhookHintOk(result.ok);
      setWebhookHint(result.ok ? "Test message sent." : (result.error ?? "Test failed."));
    } catch {
      setWebhookHintOk(false);
      setWebhookHint("Test failed.");
    } finally {
      setTestingWebhook(false);
    }
  };
```

Then, immediately after the Email Alerts `SettingRow` (the one ending at line 199), add:

```tsx
        <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 14,
              fontWeight: "600",
              marginBottom: 8,
            }}
          >
            Webhook Alerts
          </Text>
          <TextInput
            value={webhookUrl}
            onChangeText={setWebhookUrl}
            onBlur={commitWebhookUrl}
            placeholder="https://discord.com/api/webhooks/…"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Webhook URL"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: colors.foreground,
              backgroundColor: colors.background,
            }}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 12,
            }}
          >
            <Switch
              value={!!settings.webhookAlerts}
              disabled={!isAuthenticated}
              onValueChange={(v) => updateSetting("webhookAlerts", v)}
              trackColor={{
                false: colors.border,
                true: colors.primary + "88",
              }}
              thumbColor={settings.webhookAlerts ? colors.primary : colors.muted}
              accessibilityLabel="Enable webhook alerts"
              accessibilityRole="switch"
            />
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={!isAuthenticated || testingWebhook}
              onPress={handleTestWebhook}
              accessibilityLabel="Send test webhook"
              accessibilityRole="button"
            >
              <Text
                style={{
                  color: isAuthenticated ? colors.primary : colors.muted,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                {testingWebhook ? "Sending…" : "Send test"}
              </Text>
            </TouchableOpacity>
          </View>
          {webhookHint && (
            <Text
              style={{
                color: webhookHintOk ? colors.success : colors.error,
                fontSize: 13,
                marginTop: 8,
              }}
            >
              {webhookHint}
            </Text>
          )}
          {!isAuthenticated && (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
              Sign in to use webhook alerts.
            </Text>
          )}
        </View>
```

- [ ] **Step 4: Run test to verify it passes (mobile half)**

Run: `pnpm vitest run tests/webhook-alerts-ui.test.ts`
Expected: FAIL on the desktop assertion only (desktop not implemented yet). This is expected.

- [ ] **Step 5: Commit**

```bash
git add components/settings/notifications-section.tsx tests/webhook-alerts-ui.test.ts
git commit -m "feat: mobile webhook alerts config UI"
```

---

## Task 8: Desktop settings UI

**Files:**
- Modify: `desktop/src/pages/Settings.tsx` (after the Email Alerts `</label>`, ~line 1758)

- [ ] **Step 1: Implement**

Ensure `useState` is imported (already imported at line 2). Ensure `trpc` is imported (already at line 39). Add local state inside the Settings component near the other `useState` calls:

```tsx
  const [webhookUrl, setWebhookUrl] = useState(settings.alertWebhookUrl ?? "");
  const [webhookHint, setWebhookHint] = useState<string | null>(null);
  const [webhookHintOk, setWebhookHintOk] = useState(false);
  const testWebhook = trpc.notifications.testWebhook.useMutation();
```

Immediately after the Email Alerts `</label>` (line 1758), add:

```tsx
          <div className="px-3 py-2.5">
            <div className="text-sm font-medium mb-2">Webhook Alerts</div>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              onBlur={() => {
                const next = webhookUrl.trim();
                if (next !== (settings.alertWebhookUrl ?? "")) update({ alertWebhookUrl: next });
              }}
              placeholder="https://discord.com/api/webhooks/…"
              aria-label="Webhook URL"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
            <div className="flex items-center justify-between mt-3">
              <label className={`flex items-center ${settings.notificationsEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                <input
                  type="checkbox"
                  checked={!!settings.webhookAlerts}
                  onChange={(e) => update({ webhookAlerts: e.target.checked })}
                  disabled={!settings.notificationsEnabled}
                  className="mr-2"
                  aria-label="Enable webhook alerts"
                />
                <span className="text-sm">Enable webhooks</span>
              </label>
              <button
                type="button"
                disabled={testWebhook.isPending}
                onClick={async () => {
                  const url = webhookUrl.trim();
                  if (!url) {
                    setWebhookHintOk(false);
                    setWebhookHint("Enter a webhook URL first.");
                    return;
                  }
                  setWebhookHint(null);
                  const result = await testWebhook.mutateAsync({ url }).catch(() => ({
                    ok: false,
                    error: "Test failed.",
                  }));
                  setWebhookHintOk(result.ok);
                  setWebhookHint(result.ok ? "Test message sent." : (result.error ?? "Test failed."));
                }}
                className="text-sm font-medium text-brand-600 dark:text-brand-400 disabled:opacity-50"
              >
                {testWebhook.isPending ? "Sending…" : "Send test"}
              </button>
            </div>
            {webhookHint && (
              <p className={`mt-2 text-xs ${webhookHintOk ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {webhookHint}
              </p>
            )}
          </div>
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm vitest run tests/webhook-alerts-ui.test.ts`
Expected: PASS

- [ ] **Step 3: Typecheck the desktop**

Run: `pnpm check:desktop`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Settings.tsx
git commit -m "feat: desktop webhook alerts config UI"
```

---

## Task 9: Full verification + docs

**Files:**
- Modify: `todo.md`

- [ ] **Step 1: Run the full offline suite**

Run: `pnpm check && pnpm lint && pnpm test`
Expected: `tsc` 0 errors, lint 0 errors, all tests pass (DB-gated files skip).

- [ ] **Step 2: Run the DB suite**

Run: `TEST_DATABASE_URL="mysql://promptgen:promptgen@127.0.0.1:3307/stock_tracker_test" RUN_DB_TESTS=1 pnpm test:db`
Expected: all DB-gated tests pass, including the new webhook ones.

- [ ] **Step 3: Desktop check**

Run: `pnpm check:desktop && pnpm --dir desktop test`
Expected: 0 errors, all pass.

- [ ] **Step 4: Append the phase entry to `todo.md`**

```md
## Phase 1036: Webhook alerts (Discord/Slack, opt-in, server-evaluated)

- [x] `AppSettings.webhookAlerts` + `alertWebhookUrl` (default off) with mobile + desktop config UI (URL field, enable toggle, Send test).
- [x] `notification_webhook_log` (userId, dedupKey, sentAt) for once-per-condition idempotency; warmer purge after 30 days.
- [x] `server/notifications/webhook-alerts.ts`: strict Discord/Slack host allowlist (SSRF guard), provider-specific payloads, mention neutralization, 5s-timeout POST, opt-in + daily-cap gated delivery, test send.
- [x] Hook after the email loop in `evaluate.ts`; authenticated `notifications.testWebhook` (5/min) + mobile wrapper.
- [x] Tests: unit (classify/payload/text/post), DB delivery/cap/invalid-url/no-retry, pipeline integration, router, UI source guards.
- [x] `tsc 0`, lint 0 errors, offline + DB suites green; desktop green.
```

- [ ] **Step 5: Commit**

```bash
git add todo.md
git commit -m "Docs: webhook alerts phase entry (Phase 1036)"
```
