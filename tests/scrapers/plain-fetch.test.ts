import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const impitFetch = vi.fn(async () => ({
  status: 200,
  statusText: "OK",
  ok: true,
  text: async () => "<html>impit</html>",
}));
vi.mock("impit", () => ({
  Impit: class {
    fetch = impitFetch;
  },
}));

import { plainFetch } from "@/lib/scrapers/plain-fetch";

describe("plainFetch", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => impitFetch.mockClear());
  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.VITEST;
    vi.unstubAllEnvs();
  });

  it("uses the global fetch under test (so fetch stubs keep working)", async () => {
    process.env.VITEST = "true";
    const stub = vi.fn(async () => new Response("<html>global</html>", { status: 200 }));
    globalThis.fetch = stub as unknown as typeof fetch;
    const res = await plainFetch("https://x.test");
    expect(await res.text()).toBe("<html>global</html>");
    expect(stub).toHaveBeenCalledTimes(1);
    expect(impitFetch).not.toHaveBeenCalled();
  });

  it("uses impit on the server path", async () => {
    delete process.env.VITEST;
    vi.stubEnv("NODE_ENV", "production");
    const res = await plainFetch("https://x.test", { headers: { Accept: "text/html" } });
    expect(await res.text()).toBe("<html>impit</html>");
    expect(impitFetch).toHaveBeenCalledTimes(1);
  });
});
