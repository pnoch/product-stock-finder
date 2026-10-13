# Connected Marketplaces — verification evidence

**Date:** 2026-10-13
**Phase:** 1149

## Automated verification

| Check | Command | Result |
| --- | --- | --- |
| Connection service | `pnpm exec vitest run tests/marketplace-connections.test.ts` | 17 passed |
| Snapshots + extraction | `pnpm exec vitest run tests/marketplace-snapshot.test.ts tests/fb-search.test.ts` | 29 passed |
| Scoped disconnect | `pnpm exec vitest run tests/marketplace-session-clear.test.ts` | 11 passed |
| Browser policy | `pnpm exec vitest run tests/marketplace-browser-policy.test.ts` | 8 passed |
| Screen retry-once | `pnpm exec vitest run tests/connected-marketplaces-screen.test.tsx` | 3 passed |
| Typecheck | `pnpm check` | 0 errors |
| Lint | `pnpm lint` | clean |
| Full gate | `CARGO_NET_OFFLINE=true pnpm verify` | exit 0 |

The retry-once test proves a matching ready event re-runs the retained query once,
a repeated timestamp does not retry again, a different query is ignored, and a
failed verification never retries.

## Behaviors established by tests

- Verification states persist device-locally and never enter sync.
- A late verification completion cannot restore readiness after disconnect.
- Extraction binds each item to its own card; ambiguous containers are dropped.
- A header Login link alone is not a login wall; a genuine empty page is distinct
  from an unreadable page.
- Disconnect clears only the selected site's cookies and origin storage, and
  reports partial or unavailable results instead of claiming success.

## Pending: signed-in Android verification

Automated tests cannot prove that Facebook or Shopee permits login and
extraction on a real device. The following steps require a signed-in Android
device and remain unverified:

1. Connect Facebook in the visible browser, then retry the retained query in the
   hidden renderer. Record the observed location, radius, and result extraction.
2. Confirm the observed search area matches the requested area, or shows
   "Location not confirmed".
3. Test cancellation, app restart, and session expiry.
4. Disconnect Facebook and confirm it requires signing in again while unrelated
   site sessions remain.
5. Repeat the page-access check for Shopee or Lazada with a tracked listing.

Record outcomes here when the device test runs. Do not record credentials,
cookies, or private page HTML.
