import { describe, expect, it, vi } from "vitest";
import { parseProductText } from "../server/product-parse";

function llmShouldNotBeNeeded() {
  return vi.fn().mockResolvedValue({ choices: [] });
}

describe("parseProductText SSRF guard (RED)", () => {
  it("refuses metadata / private-IP URLs without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("should not fetch"));
    const llm = llmShouldNotBeNeeded();
    const blocked = [
      "http://169.254.169.254/latest/meta-data/",
      "http://127.0.0.1:3000/admin",
      "http://10.0.0.5/secret",
      "http://192.168.1.1/",
      "http://[::1]/",
    ];
    for (const url of blocked) {
      expect(await parseProductText(url, llm)).toBeNull();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("refuses non-http schemes without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("should not fetch"));
    const llm = llmShouldNotBeNeeded();
    expect(await parseProductText("file:///etc/passwd", llm)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
