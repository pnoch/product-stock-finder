import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

const read = (p: string) => readFileSync(p, "utf8");

// Count mentions outside comments, so prose that names a constant cannot make
// the wiring look present. A constant appears at least twice when it is
// actually used: once in the import and once (or more) in an expression.
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const usesConstant = (src: string, token: string) =>
  stripComments(src).split(token).length - 1 >= 2;

// The recurring failure class in this repo: a server-side cap/enum that a
// client ignores, so the server rejects a whole payload and the feature is
// silently disabled (see AGENTS.md "Client/server payload caps"). These
// assertions pin the *wiring* — not the numbers — so changing a cap means
// touching shared/const.ts and both sides, never one side's literal.
describe("server <-> client contract parity", () => {
  it("every upload/push cap is enforced by the server", () => {
    const server = read("server/routers.ts");
    for (const cap of [
      "SYNC_PUSH_MAX_ITEMS",
      "MAX_UPLOAD_ALERTS",
      "MAX_UPLOAD_STOCK_WATCHES",
      "MAX_UPLOAD_DATE_REMINDERS",
      "MAX_UPLOAD_HEALTH_EVENTS",
      "MAX_UPLOAD_HISTORY_POINTS",
    ]) {
      expect(usesConstant(server, cap), `server must enforce ${cap}`).toBe(true);
    }
  });

  it("both notification clients trim to every upload cap", () => {
    for (const client of [
      "lib/server-notifications.ts",
      "desktop/src/server-notifications.ts",
    ]) {
      const src = read(client);
      for (const cap of [
        "MAX_UPLOAD_ALERTS",
        "MAX_UPLOAD_STOCK_WATCHES",
        "MAX_UPLOAD_DATE_REMINDERS",
        "MAX_UPLOAD_HEALTH_EVENTS",
      ]) {
        expect(usesConstant(src, cap), `${client} must trim to ${cap}`).toBe(
          true,
        );
      }
    }
  });

  it("the sync pusher honours the item and byte caps", () => {
    const sync = read("lib/sync.ts");
    for (const cap of [
      "SYNC_PUSH_MAX_ITEMS",
      "SYNC_PUSH_MAX_BYTES",
      "SYNC_PUSH_ITEM_MAX_BYTES",
    ]) {
      expect(usesConstant(sync, cap), `lib/sync.ts must honour ${cap}`).toBe(
        true,
      );
    }
  });

  it("history uploads are sanitized through the shared cap on both clients", () => {
    expect(
      usesConstant(read("shared/src/history-upload.ts"), "MAX_UPLOAD_HISTORY_POINTS"),
    ).toBe(true);
    for (const client of [
      "lib/history-sync.ts",
      "desktop/src/lib/history-sync.ts",
    ]) {
      expect(
        read(client),
        `${client} must sanitize before upload`,
      ).toContain("sanitizeHistoryPoints");
    }
  });

  it("the discovery query cap is shared by the server and the client", () => {
    expect(
      usesConstant(read("server/routers/discovery.ts"), "MAX_DISCOVERY_QUERY"),
    ).toBe(true);
    expect(usesConstant(read("lib/llm-discovery.ts"), "MAX_DISCOVERY_QUERY")).toBe(
      true,
    );
  });
});
