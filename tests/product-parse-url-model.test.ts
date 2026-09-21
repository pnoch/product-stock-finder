import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

import { parseProductText } from "../server/product-parse";

function htmlResponse(html: string) {
  return {
    ok: true,
    status: 200,
    text: async () => html,
  } as unknown as Response;
}

const MIKROTIK_HTML = `<!doctype html><html><head>
<meta property="og:title" content="CRS326-24S+2Q+RM | MikroTik" />
<meta property="og:description" content="One of our faster switches for the most demanding setups." />
</head><body></body></html>`;

describe("parseProductText URL model extraction", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps '+' in MikroTik part numbers instead of truncating at the first segment", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(htmlResponse(MIKROTIK_HTML));
    const llm = vi.fn().mockResolvedValue({ choices: [] });

    const result = await parseProductText(
      "https://mikrotik.com/product/crs326_24s_2q_rm",
      llm,
    );

    expect(result).not.toBeNull();
    expect(result?.modelNumber).toBe("CRS326-24S+2Q+RM");
    // The deterministic URL path is free, so the billable LLM must not run.
    expect(llm).not.toHaveBeenCalled();
  });

  it("still extracts a plain alphanumeric model from the title", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      htmlResponse(
        `<!doctype html><html><head><title>RB5009UG+S+IN RouterBoard</title></head><body>${"x".repeat(250)}</body></html>`,
      ),
    );
    const llm = vi.fn().mockResolvedValue({ choices: [] });

    const result = await parseProductText("https://example.com/p/rb5009", llm);

    expect(result?.modelNumber).toBe("RB5009UG+S+IN");
  });
});
