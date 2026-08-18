import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface SwHarness {
  listeners: Record<string, Array<(event: unknown) => void>>;
  matchAll: ReturnType<typeof vi.fn>;
  openWindow: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

function loadSwNotificationClick(): SwHarness {
  const source = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
  const listeners: SwHarness["listeners"] = {};
  const matchAll = vi.fn();
  const openWindow = vi.fn();
  const focus = vi.fn();
  const close = vi.fn();

  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      listeners[type] = listeners[type] ?? [];
      listeners[type].push(fn);
    },
    clients: { matchAll, openWindow },
    registration: { showNotification: vi.fn() },
  };

  // Evaluate the real public/sw.js in a sandboxed `self` scope.
  new Function("self", source)(self);

  return { listeners, matchAll, openWindow, focus, close };
}

function runClick(harness: SwHarness, clients: Array<{ focus?: () => void }>) {
  harness.matchAll.mockResolvedValue(clients);
  const handler = harness.listeners["notificationclick"][0];
  let waitPromise: Promise<unknown> | null = null;
  const event = {
    notification: { close: harness.close },
    waitUntil: (p: Promise<unknown>) => {
      waitPromise = p;
    },
  };
  handler(event);
  return waitPromise;
}

describe("public/sw.js notificationclick handler", () => {
  it("focuses an existing window client when the app is open", async () => {
    const harness = loadSwNotificationClick();
    const focus = vi.fn();
    const promise = runClick(harness, [{ focus }]);

    await promise;
    expect(harness.close).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(harness.openWindow).not.toHaveBeenCalled();
  });

  it("opens the app root when no window client exists", async () => {
    const harness = loadSwNotificationClick();
    const promise = runClick(harness, []);

    await promise;
    expect(harness.close).toHaveBeenCalledTimes(1);
    expect(harness.openWindow).toHaveBeenCalledWith("/");
  });

  it("opens the app root when clients lack a focus method", async () => {
    const harness = loadSwNotificationClick();
    const promise = runClick(harness, [{}]);

    await promise;
    expect(harness.openWindow).toHaveBeenCalledWith("/");
  });
});