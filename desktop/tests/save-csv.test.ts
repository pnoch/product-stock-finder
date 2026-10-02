import { afterEach, describe, expect, it, vi } from "vitest";

const tauriState = vi.hoisted(() => ({ isTauri: false }));
vi.mock("../src/lib/tauri", () => ({ isTauri: () => tauriState.isTauri }));

const saveMock = vi.hoisted(() => vi.fn());
const writeFileMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: saveMock }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeFile: writeFileMock }));

import { saveCsv } from "../src/lib/save-csv";

describe("saveCsv", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    tauriState.isTauri = false;
  });

  it("downloads via a Blob in the browser", async () => {
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    expect(await saveCsv("x.csv", "a,b\n1,2")).toEqual({ status: "saved" });
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    expect(click).toHaveBeenCalledOnce();
  });

  it("writes the file through the Tauri dialog in the app", async () => {
    tauriState.isTauri = true;
    saveMock.mockResolvedValue("/tmp/x.csv");
    writeFileMock.mockResolvedValue(undefined);
    expect(await saveCsv("x.csv", "a,b")).toEqual({ status: "saved", path: "/tmp/x.csv" });
    expect(saveMock).toHaveBeenCalledWith({
      defaultPath: "x.csv",
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    expect(writeFileMock).toHaveBeenCalledOnce();
  });

  it("reports a cancelled Tauri save dialog as cancelled", async () => {
    tauriState.isTauri = true;
    saveMock.mockResolvedValue(null);
    expect(await saveCsv("x.csv", "a,b")).toEqual({ status: "cancelled" });
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("reports a thrown save as failed", async () => {
    tauriState.isTauri = true;
    saveMock.mockRejectedValue(new Error("boom"));
    expect(await saveCsv("x.csv", "a,b")).toEqual({ status: "failed" });
  });

  it("reports a writeFile failure as failed", async () => {
    tauriState.isTauri = true;
    saveMock.mockResolvedValue("/tmp/x.csv");
    writeFileMock.mockRejectedValue(new Error("write boom"));
    expect(await saveCsv("x.csv", "a,b")).toEqual({ status: "failed" });
  });
});
