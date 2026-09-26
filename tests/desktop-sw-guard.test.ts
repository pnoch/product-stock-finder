import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface SwHarness {
  listeners: Record<string, Array<(event: unknown) => void>>;
  matchAll: ReturnType<typeof vi.fn>;
  openWindow: ReturnType<typeof vi.fn>;
  showNotification: ReturnType<typeof vi.fn>;
}

/** Evaluates the real desktop service worker in a sandboxed `self` scope. */
function loadDesktopSw(): SwHarness {
  const source = readFileSync(join(process.cwd(), "desktop", "public", "sw.js"), "utf8");
  const listeners: SwHarness["listeners"] = {};
  const matchAll = vi.fn();
  const openWindow = vi.fn();
  const showNotification = vi.fn();
  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      listeners[type] = listeners[type] ?? [];
      listeners[type].push(fn);
    },
    clients: { matchAll, openWindow },
    registration: { showNotification },
  };
  new Function("self", source)(self);
  return { listeners, matchAll, openWindow, showNotification };
}

function runClick(harness: SwHarness, clients: unknown[], data?: unknown) {
  harness.matchAll.mockResolvedValue(clients);
  const handler = harness.listeners["notificationclick"][0];
  let waitPromise: Promise<unknown> | null = null;
  handler({
    notification: { close: vi.fn(), data },
    waitUntil: (p: Promise<unknown>) => {
      waitPromise = p;
    },
  });
  return waitPromise;
}

describe("desktop service worker", () => {
  it("handles push and notificationclick without app-specific precache", async () => {
    const text = await readFile("desktop/public/sw.js", "utf8");
    expect(text).toContain('addEventListener("push"');
    expect(text).toContain('addEventListener("notificationclick"');
    expect(text).toContain("showNotification");
    expect(text).not.toContain("precache");
    expect(text).not.toContain("_expo");
  });

  it("deep-links a clicked push notification like the mobile service worker", async () => {
    const harness = loadDesktopSw();
    const navigate = vi.fn();
    await runClick(harness, [{ focus: vi.fn(), navigate }], { productId: "crs804" });
    expect(navigate).toHaveBeenCalledWith("/product/crs804");

    const digest = loadDesktopSw();
    await runClick(digest, [], { type: "digest" });
    expect(digest.openWindow).toHaveBeenCalledWith("/stats");

    const health = loadDesktopSw();
    await runClick(health, [], { type: "health_alert" });
    expect(health.openWindow).toHaveBeenCalledWith("/health");

    // With no routing data the app root is still the fallback.
    const plain = loadDesktopSw();
    await runClick(plain, [], {});
    expect(plain.openWindow).toHaveBeenCalledWith("/");
  });

  it("carries the server's routing fields into the shown notification", async () => {
    const harness = loadDesktopSw();
    harness.matchAll.mockResolvedValue([]);
    const handler = harness.listeners["push"][0];
    let waitPromise: Promise<unknown> | null = null;
    handler({
      data: {
        json: () => ({ title: "T", body: "B", eventId: "e1", type: "digest", productId: "p1" }),
      },
      waitUntil: (p: Promise<unknown>) => {
        waitPromise = p;
      },
    });
    await waitPromise;
    expect(harness.showNotification).toHaveBeenCalledWith(
      "T",
      expect.objectContaining({ data: { eventId: "e1", type: "digest", productId: "p1" } }),
    );
  });
});
