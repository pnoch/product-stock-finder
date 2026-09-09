# Desktop Notification Settings Parity — Design

Date: 2026-09-06. Scope: health toggle, digest-day picker,
quiet-hours picker in desktop Settings (approved).

## Problem

Desktop Notifications lacks three controls mobile has: the
`healthAlerts` switch (distributor-down notifications unmutable),
the `digestDayOfWeek` picker (weekly day unchangeable), and the
`quietHours` picker (no overnight mute). All keys exist in
`AppSettings` and sync; desktop scheduling already honors them —
only the controls are missing.

## Approach

Same keys, same semantics, desktop segmented/toggle patterns
(matching the digest-frequency buttons and priceAlerts row already
in the file). No scheduling or server changes.

## Health toggle

- Row mirroring priceAlerts: label "Health Alerts", description
  "Notify when a distributor is blocked or down", checkbox
  `checked={settings.healthAlerts}`,
  `update({ healthAlerts: e.target.checked })`, disabled + dimmed
  when master `notificationsEnabled` is off.

## Digest day

- Segmented Sun–Sat buttons (same classes as the frequency
  segmented control), shown only when `digestFrequency` is
  Weekly: value `DAY_LABELS[settings.digestDayOfWeek ?? 0]`,
  `update({ digestDayOfWeek: index })`, `aria-label="Set digest
  day to {day}"`.

## Quiet hours

- Segmented Off / 22:00–07:00 / 23:00–07:00 / 00:00–08:00
  (same button classes), mapping to `undefined` /
  `{start, end}` split on "–" (same strings as mobile).
  Helper line when set: "Health alerts and digests are muted
  during quiet hours."

## Testing

- Source-guard tests: three controls with the settings keys.
- Verification: `pnpm check` (0 errors), `pnpm lint` (no new
  warnings), `pnpm test` (full suite green), desktop `pnpm build`.

## Non-goals

- Scheduling logic, server, or mobile changes.
