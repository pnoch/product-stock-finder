// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";

const state = vi.hoisted(() => ({ os: "web" as string }));
vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.os;
    },
  },
}));

const fs = vi.hoisted(() => ({
  writeAsStringAsync: vi.fn(async () => {}),
  isAvailableAsync: vi.fn(async () => true),
  shareAsync: vi.fn(async () => {}),
}));

vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "/cache/",
  writeAsStringAsync: (...a: unknown[]) => fs.writeAsStringAsync(...(a as [])),
  EncodingType: { UTF8: "utf8" },
}));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: (...a: unknown[]) => fs.isAvailableAsync(...(a as [])),
  shareAsync: (...a: unknown[]) => fs.shareAsync(...(a as [])),
}));

const createObjectURL = vi.fn(() => "blob:mock");
const revokeObjectURL = vi.fn();

beforeAll(() => {
  // jsdom doesn't implement URL.createObjectURL/revokeObjectURL
  Object.defineProperty(URL, "createObjectURL", {
    value: createObjectURL,
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: revokeObjectURL,
    configurable: true,
  });
});

import { exportCsvFile } from "../lib/csv-export";

let anchor: {
  href: string;
  download: string;
  style: Record<string, string>;
  click: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  state.os = "web";
  createObjectURL.mockReturnValue("blob:mock");
  fs.writeAsStringAsync.mockResolvedValue(undefined);
  fs.isAvailableAsync.mockResolvedValue(true);
  anchor = {
    href: "",
    download: "",
    style: {} as Record<string, string>,
    click: vi.fn(),
    remove: vi.fn(),
  };
  vi.spyOn(document, "createElement").mockReturnValue(
    anchor as unknown as HTMLElement,
  );
  vi.spyOn(document.body, "appendChild").mockImplementation(
    (() => anchor) as unknown as typeof document.body.appendChild,
  );
});

describe("exportCsvFile — web", () => {
  it("downloads the CSV under the caller-supplied filename on web", async () => {
    const result = await exportCsvFile("a,b\n1,2", "watchlist-2026-09-23.csv");
    expect(result).toBe(true);
    expect(anchor.href).toMatch(/^blob:/);
    expect(anchor.download).toBe("watchlist-2026-09-23.csv");
    expect(anchor.click).toHaveBeenCalled();
    expect(anchor.remove).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();
  });

  it("returns false on DOM error instead of throwing", async () => {
    vi.mocked(document.createElement).mockImplementation(() => {
      throw new Error("dom fail");
    });
    expect(await exportCsvFile("x", "x.csv")).toBe(false);
  });
});

describe("exportCsvFile — native", () => {
  it("writes to the cache dir and opens the share sheet", async () => {
    state.os = "ios";
    expect(await exportCsvFile("a,b\n1,2", "watchlist.csv")).toBe(true);
    expect(fs.writeAsStringAsync).toHaveBeenCalledTimes(1);
    const [uri, csv, opts] = fs.writeAsStringAsync.mock.calls[0]! as unknown as [
      string,
      string,
      { encoding: string },
    ];
    expect(uri).toBe("/cache/watchlist.csv");
    expect(csv).toBe("a,b\n1,2");
    expect(opts.encoding).toBe("utf8");
    expect(fs.shareAsync).toHaveBeenCalledWith("/cache/watchlist.csv", {
      mimeType: "text/csv",
      dialogTitle: "Export CSV",
    });
  });

  it("returns false when sharing is unavailable", async () => {
    state.os = "android";
    fs.isAvailableAsync.mockResolvedValue(false);
    expect(await exportCsvFile("x", "x.csv")).toBe(false);
    expect(fs.shareAsync).not.toHaveBeenCalled();
  });

  it("returns false when the write throws", async () => {
    state.os = "ios";
    fs.writeAsStringAsync.mockRejectedValueOnce(new Error("disk full"));
    expect(await exportCsvFile("x", "x.csv")).toBe(false);
  });
});
