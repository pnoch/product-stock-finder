import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadLog() {
  vi.resetModules();
  return import("../shared/src/log");
}

describe("log", () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).__DEV__ = true;
  });
  afterEach(() => {
    (globalThis as Record<string, unknown>).__DEV__ = true;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("maps levels to the matching console method", async () => {
    const { log } = await loadLog();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const debug = vi.spyOn(console, "log").mockImplementation(() => {});
    log.error("e");
    log.warn("w");
    log.info("i");
    log.debug("d");
    expect(error).toHaveBeenCalledWith("e");
    expect(warn).toHaveBeenCalledWith("w");
    expect(info).toHaveBeenCalledWith("i");
    expect(debug).toHaveBeenCalledWith("d");
  });

  it("silences debug/info in production but keeps warn/error", async () => {
    delete (globalThis as Record<string, unknown>).__DEV__;
    vi.stubEnv("NODE_ENV", "production");
    const { log } = await loadLog();
    const debug = vi.spyOn(console, "log").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");
    expect(debug).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("w");
    expect(error).toHaveBeenCalledWith("e");
  });

  it("forwards every level to a registered sink and never lets it throw", async () => {
    const { log, setLogSink } = await loadLog();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sink = vi.fn();
    setLogSink(sink);
    log.warn("w");
    expect(sink).toHaveBeenCalledWith("warn", ["w"]);
    setLogSink(() => {
      throw new Error("sink boom");
    });
    expect(() => log.warn("again")).not.toThrow();
    expect(warn).toHaveBeenCalledWith("again");
    setLogSink(null);
  });
});
