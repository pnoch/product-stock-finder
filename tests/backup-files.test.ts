// @vitest-environment jsdom
import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from "vitest";

// Platform.OS and the FileReader result are read at call time, so both are
// hoisted holders the tests mutate to walk the web/native branches.
const state = vi.hoisted(() => ({
  os: "web" as string,
  frResult: '{"ok":true}' as unknown,
  frFail: false,
}));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return state.os;
    },
  },
}));

const writeAsStringAsync = vi.fn(async () => {});
const readAsStringAsync = vi.fn(async () => '{"ok":true}');
const isAvailableAsync = vi.fn(async () => true);
const shareAsync = vi.fn(async () => {});
const getDocumentAsync = vi.fn(async () => ({
  canceled: false,
  assets: [{ uri: "/file.json" }],
}));

vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "/cache/",
  writeAsStringAsync: (...a: unknown[]) => writeAsStringAsync(...(a as [])),
  readAsStringAsync: (...a: unknown[]) => readAsStringAsync(...(a as [])),
  EncodingType: { UTF8: "utf8" },
}));
vi.mock("expo-sharing", () => ({
  isAvailableAsync: (...a: unknown[]) => isAvailableAsync(...(a as [])),
  shareAsync: (...a: unknown[]) => shareAsync(...(a as [])),
}));
vi.mock("expo-document-picker", () => ({
  getDocumentAsync: (...a: unknown[]) => getDocumentAsync(...(a as [])),
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

import { exportBackupFile, pickBackupFile } from "../lib/backup-files";

class MockFileReader {
  result: unknown = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsText() {
    if (state.frFail) {
      queueMicrotask(() => this.onerror?.());
      return;
    }
    this.result = state.frResult;
    queueMicrotask(() => this.onload?.());
  }
}

type MockInput = {
  type: string;
  accept: string;
  files: unknown[];
  onchange: (() => void) | null;
  oncancel: (() => void) | null;
  style: Record<string, string>;
  click: ReturnType<typeof vi.fn>;
};

function makeInput(): MockInput {
  return {
    type: "",
    accept: "",
    files: [],
    onchange: null,
    oncancel: null,
    style: {},
    click: vi.fn(),
  };
}

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
  state.frResult = '{"ok":true}';
  state.frFail = false;
  createObjectURL.mockReturnValue("blob:mock");
  readAsStringAsync.mockResolvedValue('{"ok":true}');
  isAvailableAsync.mockResolvedValue(true);
  getDocumentAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: "/file.json" }],
  });
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("exportBackupFile — web", () => {
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

describe("exportBackupFile — native", () => {
  it("writes the file and shares it", async () => {
    state.os = "ios";
    expect(await exportBackupFile('{"a":1}')).toBe(true);
    expect(writeAsStringAsync).toHaveBeenCalledTimes(1);
    const [uri, json, opts] = writeAsStringAsync.mock.calls[0]! as unknown as [
      string,
      string,
      { encoding: string },
    ];
    expect(uri).toContain("/cache/product-stock-finder-backup-");
    expect(json).toBe('{"a":1}');
    expect(opts.encoding).toBe("utf8");
    expect(shareAsync).toHaveBeenCalledTimes(1);
  });

  it("returns false when sharing is unavailable", async () => {
    state.os = "android";
    isAvailableAsync.mockResolvedValue(false);
    expect(await exportBackupFile("x")).toBe(false);
    expect(shareAsync).not.toHaveBeenCalled();
  });

  it("returns false when the write throws", async () => {
    state.os = "ios";
    writeAsStringAsync.mockRejectedValueOnce(new Error("disk full"));
    expect(await exportBackupFile("x")).toBe(false);
  });
});

describe("pickBackupFile — web", () => {
  beforeEach(() => {
    vi.stubGlobal("FileReader", MockFileReader);
  });

  it("reads the selected file as text", async () => {
    const input = makeInput();
    vi.mocked(document.createElement).mockReturnValue(
      input as unknown as HTMLElement,
    );
    const promise = pickBackupFile();
    expect(input.accept).toContain("application/json");
    input.files = [{ name: "backup.json" }];
    input.onchange?.();
    await expect(promise).resolves.toBe('{"ok":true}');
  });

  it("resolves null when the picker returns no file", async () => {
    const input = makeInput();
    vi.mocked(document.createElement).mockReturnValue(
      input as unknown as HTMLElement,
    );
    const promise = pickBackupFile();
    input.files = [];
    input.onchange?.();
    await expect(promise).resolves.toBeNull();
  });

  it("resolves null when the reader errors", async () => {
    const input = makeInput();
    vi.mocked(document.createElement).mockReturnValue(
      input as unknown as HTMLElement,
    );
    const promise = pickBackupFile();
    input.files = [{ name: "backup.json" }];
    state.frFail = true;
    input.onchange?.();
    await expect(promise).resolves.toBeNull();
  });

  it("resolves null for a non-string read result", async () => {
    const input = makeInput();
    vi.mocked(document.createElement).mockReturnValue(
      input as unknown as HTMLElement,
    );
    const promise = pickBackupFile();
    input.files = [{ name: "backup.json" }];
    state.frResult = new ArrayBuffer(0);
    input.onchange?.();
    await expect(promise).resolves.toBeNull();
  });

  it("resolves null when the user cancels", async () => {
    const input = makeInput();
    vi.mocked(document.createElement).mockReturnValue(
      input as unknown as HTMLElement,
    );
    const promise = pickBackupFile();
    input.oncancel?.();
    await expect(promise).resolves.toBeNull();
  });
});

describe("pickBackupFile — native", () => {
  it("reads the picked document", async () => {
    state.os = "android";
    readAsStringAsync.mockResolvedValue('{"x":1}');
    await expect(pickBackupFile()).resolves.toBe('{"x":1}');
    expect(readAsStringAsync).toHaveBeenCalledWith("/file.json");
  });

  it("returns null when the picker is canceled", async () => {
    state.os = "android";
    getDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });
    await expect(pickBackupFile()).resolves.toBeNull();
  });

  it("returns null when no asset is returned", async () => {
    state.os = "ios";
    getDocumentAsync.mockResolvedValue({ canceled: false, assets: [] });
    await expect(pickBackupFile()).resolves.toBeNull();
  });

  it("returns null when the picker throws", async () => {
    state.os = "android";
    getDocumentAsync.mockRejectedValueOnce(new Error("picker fail"));
    await expect(pickBackupFile()).resolves.toBeNull();
  });
});
