import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTelemetrySink, track } from "../lib/telemetry";

afterEach(() => setTelemetrySink(null));

describe("telemetry", () => {
  it("is a no-op with no sink", () => {
    expect(() => track("app_open")).not.toThrow();
  });

  it("forwards events to a registered sink", () => {
    const sink = { track: vi.fn() };
    setTelemetrySink(sink);
    track("product_added", { productId: "p1" });
    expect(sink.track).toHaveBeenCalledWith("product_added", { productId: "p1" });
  });

  it("never throws when the sink throws", () => {
    setTelemetrySink({
      track: () => {
        throw new Error("sink down");
      },
    });
    expect(() => track("app_open")).not.toThrow();
  });

  it("swallows a rejecting async sink", async () => {
    setTelemetrySink({
      track: (() => Promise.reject(new Error("async sink down"))) as never,
    });
    expect(() => track("app_open")).not.toThrow();
    await Promise.resolve();
  });

  it("call sites pass no PII or secrets", () => {
    const files = [
      "app/search.tsx",
      "app/(tabs)/watchlist.tsx",
      "app/(tabs)/settings.tsx",
      "app/w/[token].tsx",
    ];
    for (const f of files) {
      const src = readFileSync(join(__dirname, "..", f), "utf8");
      for (const m of src.matchAll(/track\(\s*"[^"]+"\s*,\s*(\{[^}]*\})/g)) {
        expect(m[1], `${f}: ${m[1]}`).not.toMatch(/email|apiKey|token|password/i);
      }
    }
  });
});
