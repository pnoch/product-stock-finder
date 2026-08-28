// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "/cache/",
  writeAsStringAsync: vi.fn(async () => {}),
  readAsStringAsync: vi.fn(async () => '{"ok":true}'),
  EncodingType: { UTF8: "utf8" },
}));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: vi.fn(async () => true),
  shareAsync: vi.fn(async () => {}),
}));
vi.mock("expo-document-picker", () => ({
  getDocumentAsync: vi.fn(async () => ({
    canceled: false,
    assets: [{ uri: "/file.json" }],
  })),
}));

const createObjectURL = vi.fn(() => "blob:mock");
const revokeObjectURL = vi.fn();

beforeAll(() => {
  // jsdom doesn't implement URL.createObjectURL/revokeObjectURL
  Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
});

import { exportBackupFile } from "../lib/backup-files";

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

describe("exportBackupFile", () => {
  it("creates blob URL and triggers download on web", async () => {
    const result = await exportBackupFile('{"a":1}');
    expect(result).toBe(true);
    expect(anchor.href).toMatch(/^blob:/);
    expect(anchor.download).toContain(".json");
    expect(anchor.click).toHaveBeenCalled();
    expect(anchor.remove).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();
  });

  it("returns false on DOM error", async () => {
    vi.mocked(document.createElement).mockImplementation(() => {
      throw new Error("dom fail");
    });
    expect(await exportBackupFile("x")).toBe(false);
  });
});
