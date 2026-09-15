export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const SESSION_MS = 1000 * 60 * 60 * 24 * 30;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = "Please login (10001)";
export const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
export const DEVICE_REVOKED_ERR_MSG = "This device was signed out (10003)";
export const PRICE_HISTORY_SYNC_DAYS = 30;
export const PRICE_HISTORY_DAYS = 365;
// How long a server price snapshot counts as fresh. Shared by the server
// cache (server/prices.ts) and every client consumer so the TTL cannot drift.
export const PRICE_SNAPSHOT_TTL_MS = 60 * 60 * 1000;

// Upload caps for notifications.uploadConfig. The server rejects payloads over
// these, so the client must trim to the same bounds before sending — otherwise
// a user with more items than the cap has their entire config rejected.
export const MAX_UPLOAD_ALERTS = 200;
export const MAX_UPLOAD_STOCK_WATCHES = 200;
export const MAX_UPLOAD_DATE_REMINDERS = 200;
export const MAX_UPLOAD_HEALTH_EVENTS = 100;

// Max items per sync.push call. The client batches dirty items to this size so
// a large local change set is never rejected as one oversized payload.
export const SYNC_PUSH_MAX_ITEMS = 200;

// Max items returned per sync.pull. A full resync returns every live row plus
// tombstones, so an unbounded result set could be huge; the client pages by
// re-pulling until `hasMore` is false.
export const SYNC_PULL_MAX_ITEMS = 500;

// Max price-history points per prices.uploadHistory call. The client must trim
// to this (keeping the newest) or the whole upload is rejected.
export const MAX_UPLOAD_HISTORY_POINTS = 200;
