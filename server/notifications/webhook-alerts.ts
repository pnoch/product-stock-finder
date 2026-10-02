import { and, eq, gte, lt } from "drizzle-orm";
import { appSettings, notificationWebhookLog } from "../../drizzle/schema";
import { affectedRowsOf, getDb } from "../db";

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
    .replace(/<@[^>]*>/g, "[mention]")
    .replace(/<!([^>]+)>/g, "[$1]");
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
      // A 3xx from an allowlisted host must not be followed: the Location target
      // was never validated against the allowlist (SSRF escape).
      redirect: "error",
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
      )
      .limit(DAILY_CAP);
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
