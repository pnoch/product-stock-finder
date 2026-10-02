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
