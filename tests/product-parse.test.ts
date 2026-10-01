import { describe, expect, it, vi } from "vitest";
import {
  fetchPinned,
  isBlockedUrl,
  parseProductText,
  pinnedLookup,
  readCapped,
} from "../server/product-parse";

const dnsLookup = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup: dnsLookup }));

function htmlResponse(html: string) {
  return { ok: true, status: 200, body: null, text: async () => html };
}

const LONG = "x".repeat(220);

function llmReturning(content: string | null) {
  return vi.fn().mockResolvedValue({
    choices: content === null ? [] : [{ message: { content } }],
  });
}

describe("parseProductText", () => {
  it("extracts and trims fields from LLM JSON output", async () => {
    const llm = llmReturning(
      JSON.stringify({
        name: "  MikroTik CRS326 Switch ",
        modelNumber: "CRS326-24S+2Q+RM",
        brand: "MikroTik",
        category: "Networking Switch",
        description: "  24-port switch.  ",
      }),
    );
    const result = await parseProductText("crs326 switch 24 port", llm);
    expect(result).toEqual({
      name: "MikroTik CRS326 Switch",
      modelNumber: "CRS326-24S+2Q+RM",
      brand: "MikroTik",
      category: "Networking Switch",
      description: "24-port switch.",
    });
    expect(llm).toHaveBeenCalledOnce();
  });

  it("fills defaults for missing optional fields", async () => {
    const llm = llmReturning(
      JSON.stringify({ name: "Widget", modelNumber: "W-1" }),
    );
    const result = await parseProductText("widget w-1", llm);
    expect(result).toEqual({
      name: "Widget",
      modelNumber: "W-1",
      brand: "",
      category: "Other",
      description: "",
    });
  });

  it("returns null when name or modelNumber missing", async () => {
    const llm = llmReturning(JSON.stringify({ name: "No Model" }));
    expect(await parseProductText("x", llm)).toBeNull();
  });

  it("returns null on non-JSON LLM output", async () => {
    const llm = llmReturning("sure thing, here you go");
    expect(await parseProductText("x", llm)).toBeNull();
  });

  it("returns null when the LLM call throws", async () => {
    const llm = vi.fn().mockRejectedValue(new Error("no api key"));
    expect(await parseProductText("x", llm)).toBeNull();
  });

  it("truncates over-long fields", async () => {
    const llm = llmReturning(
      JSON.stringify({
        name: "N".repeat(300),
        modelNumber: "M".repeat(200),
        brand: "B".repeat(200),
        category: "C".repeat(200),
        description: "D".repeat(2000),
      }),
    );
    const result = (await parseProductText("x", llm))!;
    expect(result.name.length).toBe(200);
    expect(result.modelNumber.length).toBe(100);
    expect(result.brand.length).toBe(100);
    expect(result.category.length).toBe(100);
    expect(result.description.length).toBe(1000);
  });
});

describe("URL scrape hardening", () => {
  function streamBody(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let i = 0;
    return new ReadableStream({
      pull(controller) {
        if (i >= chunks.length) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(chunks[i++]!));
      },
    });
  }

  it("stops reading a response far past the size cap", async () => {
    // The reader is what stops a huge/endless body from being buffered and
    // exhausting the process (res.text() would read all of it first).
    const chunks = Array.from({ length: 40 }, () => "x".repeat(100_000));
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulls >= chunks.length) {
          controller.close();
          return;
        }
        controller.enqueue(new TextEncoder().encode(chunks[pulls++]!));
      },
    });
    const result = await readCapped(
      { body } as unknown as Response,
      1_000_000,
    );
    expect(result).toBeNull();
    expect(pulls).toBeGreaterThan(0);
    expect(pulls).toBeLessThan(chunks.length);
  });

  it("caps the free scrape branch with its own process-wide budget", async () => {
    const budget = await import("../server/spend-budget");
    const spy = vi.spyOn(budget, "tryConsumeBudget");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: streamBody(["<html><head><title>Router</title></head><body>ok</body></html>"]),
      }),
    );
    try {
      await parseProductText("http://93.184.216.34/routers");
      expect(spy).toHaveBeenCalledWith("products.parseUrl");
    } finally {
      vi.unstubAllGlobals();
      spy.mockRestore();
    }
  });

  it("parses the h1 when the page has no title or og:title", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        htmlResponse(`<html><body>${LONG}<h1>MikroTik hEX S</h1></body></html>`),
      ),
    );
    try {
      const result = await parseProductText("http://93.184.216.34/");
      expect(result?.name).toBe("MikroTik hEX S");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("derives the model from the URL path when the title has none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        htmlResponse(`<html><head><title>A1 22</title></head><body>${LONG}</body></html>`),
      ),
    );
    try {
      const result = await parseProductText("http://93.184.216.34/CRS328/");
      expect(result?.modelNumber).toBe("CRS328");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns null when the scrape throws and the LLM finds nothing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));
    try {
      expect(
        await parseProductText("http://93.184.216.34/", llmReturning(null)),
      ).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("treats an unresolvable host as blocked", async () => {
    dnsLookup.mockRejectedValueOnce(new Error("ENOTFOUND"));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      expect(
        await parseProductText("http://rebind.example/product", llmReturning(null)),
      ).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("IPv6 embedded IPv4 addresses", () => {
  it("blocks the NAT64 and 6to4 forms that encode a private IPv4", () => {
    // NAT64 64:ff9b::/96 and 6to4 2002::/16 route to the embedded IPv4 on hosts
    // with that support, and the literal skipped the DNS re-check entirely.
    for (const url of [
      "http://[64:ff9b::a9fe:a9fe]/", // 169.254.169.254 (cloud metadata)
      "http://[64:ff9b::7f00:1]/", // 127.0.0.1
      "http://[2002:7f00:1::]/", // 6to4 -> 127.0.0.1
      "http://[2002:a9fe:a9fe::]/", // 6to4 -> 169.254.169.254
    ]) {
      expect(isBlockedUrl(url), url).toBe(true);
    }
    // A public embedded address is still allowed.
    expect(isBlockedUrl("http://[64:ff9b::5db8:d822]/")).toBe(false);
  });
});

describe("DNS pinning (rebinding guard)", () => {
  it("answers with the vetted addresses regardless of the hostname", () => {
    const lookup = pinnedLookup([{ address: "93.184.216.34", family: 4 }]);
    // Single-address form.
    let single: unknown[] = [];
    (lookup as unknown as (
      h: string,
      o: unknown,
      cb: (...a: unknown[]) => void,
    ) => void)("rebind.example", undefined, (...args) => {
      single = args;
    });
    expect(single).toEqual([null, "93.184.216.34", 4]);

    // All-addresses form (undici uses this when it wants every candidate).
    let all: unknown[] = [];
    (lookup as unknown as (
      h: string,
      o: unknown,
      cb: (...a: unknown[]) => void,
    ) => void)("rebind.example", { all: true }, (...args) => {
      all = args;
    });
    expect(all[0]).toBeNull();
    expect(all[1]).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });

  it("connects to the pinned address instead of re-resolving the hostname", async () => {
    // The gate resolves once; the connection must reuse that answer, or a
    // rebinding name could answer public for the check and private for the
    // connection. The hostname here does not resolve at all, so only the pin
    // can make the request succeed.
    const http = await import("node:http");
    const server = http.createServer((_req, res) => res.end("ok"));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;
    try {
      const pinned = await fetchPinned(
        `http://pinned-rebind.test:${port}/`,
        {},
        [{ address: "127.0.0.1", family: 4 }],
      );
      expect(pinned.status).toBe(200);
      expect(await pinned.text()).toBe("ok");
    } finally {
      server.close();
    }
  });
});
