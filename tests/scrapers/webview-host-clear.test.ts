import { describe, expect, it } from "vitest";
import {
  buildClearStorageJS,
  STORAGE_CLEARED_SENTINEL,
} from "@/lib/scrapers/webview-host";

describe("buildClearStorageJS", () => {
  it("clears local + session storage and posts the sentinel", () => {
    const js = buildClearStorageJS();
    expect(js).toContain("localStorage.clear()");
    expect(js).toContain("sessionStorage.clear()");
    expect(js).toContain(STORAGE_CLEARED_SENTINEL);
    expect(js).toContain("window.ReactNativeWebView.postMessage");
  });
});
