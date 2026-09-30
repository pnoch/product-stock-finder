import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/trpc", () => ({
  createTRPCClient: vi.fn(),
}));
vi.mock("../constants/oauth", () => ({
  isServerConfigured: vi.fn(() => true),
}));

import { createTRPCClient } from "../lib/trpc";
import { isServerConfigured } from "../constants/oauth";
import { testLlmConnection } from "../lib/server-llm";

const mockedCreateClient = vi.mocked(createTRPCClient);
const mockedConfigured = vi.mocked(isServerConfigured);

function mockMutate(result: unknown) {
  const mutate = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  mockedCreateClient.mockReturnValue({ llm: { test: { mutate } } } as never);
  return mutate;
}

describe("testLlmConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedConfigured.mockReturnValue(true);
  });

  it("returns null when the server is not configured", async () => {
    mockedConfigured.mockReturnValue(false);
    expect(await testLlmConnection()).toBeNull();
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("returns the provider result on success", async () => {
    mockMutate({ ok: true, provider: "openai" });
    expect(await testLlmConnection()).toEqual({ ok: true, provider: "openai" });
  });

  it("returns an auth-failure result", async () => {
    mockMutate({ ok: false, provider: "openai", reason: "auth" });
    expect(await testLlmConnection()).toEqual({
      ok: false,
      provider: "openai",
      reason: "auth",
    });
  });

  it("returns null when the call throws (unreachable server)", async () => {
    mockMutate(new Error("network down"));
    expect(await testLlmConnection()).toBeNull();
  });
});
