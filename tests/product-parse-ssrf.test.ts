import { describe, expect, it, vi } from "vitest";
import { isBlockedUrl, parseProductText } from "../server/product-parse";

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

describe("isBlockedUrl IPv6 embedded-IPv4 forms", () => {
  // Node normalizes an IPv6 literal (including `::ffff:127.0.0.1`) to its hex
  // form, so these exercise the hextet classification in isPrivateHostname.
  const blocked = [
    "http://[::ffff:7f00:1]/", // IPv4-mapped 127.0.0.1
    "http://[::ffff:a9fe:a9fe]/", // IPv4-mapped 169.254.169.254 (metadata)
    "http://[64:ff9b::a9fe:a9fe]/", // NAT64 well-known prefix → metadata
    "http://[2002:7f00:1::]/", // 6to4 → 127.0.0.1
    "http://[2001:0:1234:5678:9abc:def0:80ff:fffe]/", // Teredo → 127.0.0.1
    "http://[fe80::1]/", // link-local
    "http://[fc00::1]/", // unique local
    "http://[ff02::1]/", // multicast
    "http://[::1]/", // loopback
    "http://[::]/", // unspecified
  ];
  for (const url of blocked) {
    it(`blocks ${url}`, () => {
      expect(isBlockedUrl(url)).toBe(true);
    });
  }

  it("allows public IPv6", () => {
    expect(isBlockedUrl("http://[2606:4700:4700::1111]/")).toBe(false);
    // Teredo with a public embedded client address.
    expect(
      isBlockedUrl("http://[2001:0:1234:5678:9abc:def0:1234:5678]/"),
    ).toBe(false);
  });

  it("blocks invalid URLs, non-http schemes, and userinfo", () => {
    expect(isBlockedUrl("not a url")).toBe(true);
    expect(isBlockedUrl("file:///etc/passwd")).toBe(true);
    expect(isBlockedUrl("http://user:pass@example.com/")).toBe(true);
  });

  it("blocks the IPv4 private ranges", () => {
    for (const ip of ["127.0.0.1", "10.0.0.1", "192.168.1.1", "172.16.0.1", "169.254.169.254", "0.0.0.0"]) {
      expect(isBlockedUrl(`http://${ip}/`)).toBe(true);
    }
    expect(isBlockedUrl("http://172.32.0.1/")).toBe(false);
  });
});
