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
