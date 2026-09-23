// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "/cache/",
  writeAsStringAsync: vi.fn(async () => {}),
  EncodingType: { UTF8: "utf8" },
}));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: vi.fn(async () => true),
  shareAsync: vi.fn(async () => {}),
}));

const createObjectURL = vi.fn(() => "blob:mock");
const revokeObjectURL = vi.fn();

beforeAll(() => {
  // jsdom doesn't implement URL.createObjectURL/revokeObjectURL
  Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
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
  createObjectURL.mockReturnValue("blob:mock");
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

describe("exportCsvFile", () => {
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
