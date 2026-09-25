import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("BYO-LLM client wiring", () => {
  it("forwards x-llm-* headers from both tRPC clients", async () => {
    const mobile = await readFile("lib/trpc.ts", "utf8");
    const desktop = await readFile("desktop/src/lib/trpc.ts", "utf8");
    for (const src of [mobile, desktop]) {
      expect(src).toContain("byoLlmHeaders");
      expect(src).toContain('headers["x-llm-provider"] = provider');
      expect(src).toContain('headers["x-llm-key"] = settings.llmApiKey');
      // Forge (or unreadable settings) must send nothing extra.
      expect(src).toContain('if (!provider || provider === "forge") return {};');
    }
    expect(mobile).toContain("...llmHeaders");
    expect(desktop).toContain("...(await byoLlmHeaders())");
  });

  it("has the server consume the headers and skip the budget for BYO", async () => {
    const discovery = await readFile("server/routers/discovery.ts", "utf8");
    expect(discovery).toContain("userLlmConfigFromHeaders(ctx.req.headers)");
    expect(discovery).toContain("if (!userLlm && !tryConsumeBudget(");

    const routers = await readFile("server/routers.ts", "utf8");
    expect(routers).toContain(
      "getInsight(input.productId, userLlmConfigFromHeaders(ctx.req.headers))",
    );

    const insights = await readFile("server/price-insights.ts", "utf8");
    expect(insights).toContain("if (!userLlm && !tryConsumeBudget(");
  });
});

describe("BYO-LLM connection test", () => {
  it("registers the llm.test endpoint", async () => {
    const routers = await readFile("server/routers.ts", "utf8");
    expect(routers).toContain("llm: llmRouter");
    const router = await readFile("server/routers/llm.ts", "utf8");
    expect(router).toContain("invokeUserLlm(userLlm");
    expect(router).toContain('e instanceof UserLlmAuthError ? "auth" : "error"');
  });

  it("wires a Test connection control in both settings UIs", async () => {
    const mobile = await readFile(
      "components/settings/llm-settings-section.tsx",
      "utf8",
    );
    expect(mobile).toContain("testLlmConnection()");
    expect(mobile).toContain("Test connection");
    expect(mobile).toContain('provider !== "forge"');

    const desktop = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(desktop).toContain("testLlmConnection()");
    expect(desktop).toContain("Test connection");
  });
});
