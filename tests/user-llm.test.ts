import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  invokeUserLlm,
  resolveOllamaLocalUrl,
  userLlmConfigFromHeaders,
} from "../server/user-llm";
import { invokeLLM } from "../server/_core/llm";

vi.mock("../server/_core/llm", () => ({ invokeLLM: vi.fn() }));

function okJson(payload: unknown) {
  return { ok: true, status: 200, json: async () => payload };
}

describe("userLlmConfigFromHeaders", () => {
  it("returns null without a provider or for the built-in forge provider", () => {
    expect(userLlmConfigFromHeaders({})).toBeNull();
    expect(userLlmConfigFromHeaders({ "x-llm-provider": "forge" })).toBeNull();
  });

  it("ignores an unknown provider", () => {
    expect(userLlmConfigFromHeaders({ "x-llm-provider": "anthropic" })).toBeNull();
  });

  it("parses a valid BYO provider with its bounded fields", () => {
    expect(
      userLlmConfigFromHeaders({
        "x-llm-provider": "openai",
        "x-llm-key": "sk-test",
        "x-llm-model": "gpt-4o-mini",
      }),
    ).toEqual({
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-4o-mini",
      ollamaUrl: undefined,
    });
  });

  it("drops over-long values instead of forwarding them", () => {
    const cfg = userLlmConfigFromHeaders({
      "x-llm-provider": "openai",
      "x-llm-key": "x".repeat(600),
    });
    expect(cfg?.apiKey).toBeUndefined();
    expect(cfg?.provider).toBe("openai");
  });
});

describe("resolveOllamaLocalUrl", () => {
  it("allows loopback hosts and defaults to localhost", () => {
    expect(resolveOllamaLocalUrl(undefined)).toBe(
      "http://localhost:11434/api/chat",
    );
    expect(resolveOllamaLocalUrl("http://127.0.0.1:11434")).toBe(
      "http://127.0.0.1:11434/api/chat",
    );
    expect(resolveOllamaLocalUrl("http://[::1]:11434")).toBe(
      "http://[::1]:11434/api/chat",
    );
  });

  it("rejects non-loopback hosts and non-http schemes (SSRF guard)", () => {
    expect(resolveOllamaLocalUrl("http://10.0.0.5:11434")).toBeNull();
    expect(resolveOllamaLocalUrl("http://169.254.169.254")).toBeNull();
    expect(resolveOllamaLocalUrl("https://ollama.com")).toBeNull();
    expect(resolveOllamaLocalUrl("file:///etc/passwd")).toBeNull();
  });
});

describe("invokeUserLlm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("delegates to the built-in LLM for forge/null", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [] } as never);
    await invokeUserLlm(null, { messages: [] });
    await invokeUserLlm({ provider: "forge" }, { messages: [] });
    expect(invokeLLM).toHaveBeenCalledTimes(2);
  });

  it("posts to OpenAI with the user's key and model", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okJson({ choices: [{ message: { content: "hi" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await invokeUserLlm(
      { provider: "openai", apiKey: "sk-1", model: "gpt-4o-mini" },
      { messages: [{ role: "user", content: "x" }], maxTokens: 50 },
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-1");
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "gpt-4o-mini",
      max_tokens: 50,
    });
    expect(result.choices[0]!.message.content).toBe("hi");
  });

  it("requires an OpenAI key", async () => {
    await expect(
      invokeUserLlm({ provider: "openai" }, { messages: [] }),
    ).rejects.toThrow("OpenAI API key");
  });

  it("posts to Ollama Cloud with Bearer auth and normalizes the response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okJson({ message: { content: "hey" } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await invokeUserLlm(
      { provider: "ollama", apiKey: "ollama_1", model: "gemma4" },
      { messages: [], maxTokens: 10 },
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ollama.com/api/chat");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer ollama_1",
    );
    expect(result.choices[0]!.message.content).toBe("hey");
  });

  it("requires an Ollama Cloud key", async () => {
    await expect(
      invokeUserLlm({ provider: "ollama" }, { messages: [] }),
    ).rejects.toThrow("Ollama Cloud API key");
  });

  it("posts to a loopback Ollama without auth and rejects a remote URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okJson({ message: { content: "local" } }));
    vi.stubGlobal("fetch", fetchMock);
    await invokeUserLlm(
      { provider: "ollama-local", ollamaUrl: "http://127.0.0.1:11434" },
      { messages: [] },
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:11434/api/chat");
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();

    await expect(
      invokeUserLlm(
        { provider: "ollama-local", ollamaUrl: "http://10.0.0.5:11434" },
        { messages: [] },
      ),
    ).rejects.toThrow("loopback");
  });

  it("surfaces only the provider status on error (never the response body)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "bad key sk-1" } }),
      }),
    );
    await expect(
      invokeUserLlm({ provider: "openai", apiKey: "sk-1" }, { messages: [] }),
    ).rejects.toThrow("LLM provider error (401)");
  });
});
