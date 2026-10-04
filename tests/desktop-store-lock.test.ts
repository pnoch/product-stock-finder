import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIB_RS = path.join(__dirname, "../desktop/src-tauri/src/lib.rs");

// Top-level `fn` bodies end at a `}` on its own line; nested closes are indented.
function fnBody(src: string, signature: string): string {
  const start = src.indexOf(signature);
  expect(start, `signature not found: ${signature}`).toBeGreaterThanOrEqual(0);
  const end = src.indexOf("\n}\n", start);
  return src.slice(start, end);
}

// Every mirrored-file read-modify-write/plain write the renderer or poller can
// perform. Two of these interleaving is a lost update (the renderer mirror
// reverting a poller price, or vice versa), so all must share STORE_FILE_LOCK.
const LOCKED_WRITERS = [
  "async fn set_value_for_key(",
  "async fn merge_watchlist(",
  "async fn apply_alert_mutations(",
  "async fn import_watchlist(",
  "fn update_listing_price(",
  "fn check_price_drops_inner(",
];

describe("desktop mirrored-file writes are serialized", () => {
  const src = readFileSync(LIB_RS, "utf8");

  it("defines one process-wide store lock", () => {
    expect(src).toContain("static STORE_FILE_LOCK");
  });

  it("takes the store lock in every mirrored-file writer", () => {
    for (const signature of LOCKED_WRITERS) {
      expect(fnBody(src, signature), signature).toContain("STORE_FILE_LOCK.lock()");
    }
  });

  it("has no leftover per-alert lock name", () => {
    expect(src).not.toContain("ALERTS_FILE_LOCK");
  });
});
