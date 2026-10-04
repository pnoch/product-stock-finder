import { describe, it, expect, vi, beforeEach } from "vitest";

const check = vi.fn();
vi.mock("@tauri-apps/plugin-updater", () => ({
  check: (...args: unknown[]) => check(...args),
}));

const isTauri = vi.fn();
vi.mock("../src/lib/tauri", () => ({
  isTauri: () => isTauri(),
}));

import { checkForUpdates } from "../src/lib/app-updater";

describe("checkForUpdates", () => {
  beforeEach(() => {
    check.mockReset();
    isTauri.mockReset();
  });

  it("returns unsupported outside Tauri without touching the plugin", async () => {
    isTauri.mockReturnValue(false);
    expect(await checkForUpdates()).toEqual({ kind: "unsupported" });
    expect(check).not.toHaveBeenCalled();
  });

  it("returns none when the endpoint reports no update", async () => {
    isTauri.mockReturnValue(true);
    check.mockResolvedValue(null);
    expect(await checkForUpdates()).toEqual({ kind: "none" });
  });

  it("returns the available update with its version and notes", async () => {
    isTauri.mockReturnValue(true);
    const update = { version: "9.9.9", body: "notes", downloadAndInstall: vi.fn() };
    check.mockResolvedValue(update);
    const result = await checkForUpdates();
    expect(result).toMatchObject({ kind: "available", version: "9.9.9", notes: "notes" });
    if (result.kind === "available") expect(result.update).toBe(update);
  });
});
