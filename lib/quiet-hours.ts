import type { AppSettings } from "./types";

function parseQuietTime(value: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function isInQuietHours(
  settings: AppSettings,
  now: Date = new Date(),
): boolean {
  const qh = settings.quietHours;
  if (!qh?.start || !qh?.end) return false;
  const start = parseQuietTime(qh.start);
  const end = parseQuietTime(qh.end);
  if (start === null || end === null) return false;
  if (start === end) return false;
  // `utcOffsetMinutes` lets the server evaluate the window in the *user's*
  // local time instead of the server process timezone. The client sends its
  // offset (Date.getTimezoneOffset() semantics: minutes to add to local to get
  // UTC), so local = utc - offset.
  const offset =
    typeof qh.utcOffsetMinutes === "number" ? qh.utcOffsetMinutes : null;
  const cur =
    offset === null
      ? now.getHours() * 60 + now.getMinutes()
      : ((now.getUTCHours() * 60 + now.getUTCMinutes() - offset) % 1440 + 1440) %
        1440;
  if (start < end) {
    return cur >= start && cur < end;
  }
  return cur >= start || cur < end;
}
