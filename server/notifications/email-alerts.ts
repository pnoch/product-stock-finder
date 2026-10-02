import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import { appSettings, notificationEmailLog, users } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { affectedRowsOf, getDb } from "../db";
import { isEmailConfigured, sendEmail } from "../email";
import type { EmailMessage } from "../email";

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
    `<a href="${unsubscribeUrl}">Unsubscribe from email alerts</a></p>`;
  return { to: "", subject: title, html, text: textLines.join("\n") };
}

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

    // Insert-or-ignore on (userId, dedupKey). mysql2 enables CLIENT_FOUND_ROWS
    // by default, so `ON DUPLICATE KEY UPDATE sentAt = sentAt` reports
    // affectedRows 1 for both a fresh insert and a no-op duplicate. INSERT
    // IGNORE instead reports 1 for a fresh insert and 0 when the row exists.
    const insertResult = await db
      .insert(notificationEmailLog)
      .ignore()
      .values({ userId, dedupKey: event.dedupKey, sentAt: now });
    if (affectedRowsOf(insertResult) !== 1) return false;

    const message = buildAlertEmail({
      title: event.title,
      body: event.body,
      productUrl: event.productId ? `${origin}/product/${event.productId}` : null,
      unsubscribeUrl: unsubscribeUrlFor(userId, origin),
    });
    const ok = await sendEmail({ ...message, to: email });
    if (!ok) {
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
