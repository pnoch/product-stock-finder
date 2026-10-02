import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "../_core/env";
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
