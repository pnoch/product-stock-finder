import { describe, expect, it, vi } from "vitest";

vi.mock("../server/db", () => ({
  getUserByEmail: vi.fn(async () => ({
    id: 42,
    openId: "open-42",
    email: "a@b.com",
    name: "A",
    passwordHash: "hashed",
  })),
  upsertUser: vi.fn(async () => {}),
}));

vi.mock("bcryptjs", () => ({
  default: { compare: vi.fn(async () => true) },
  compare: vi.fn(async () => true),
}));

import { sdk } from "../server/_core/sdk";

describe("sdk login device binding", () => {
  it("embeds deviceId in the issued JWT when provided", async () => {
    const result = await sdk.login({
      email: "a@b.com",
      password: "secret123",
      deviceId: "dev-9",
    });
    const session = await sdk.verifySession(result.sessionToken);
    expect(session?.deviceId).toBe("dev-9");
  });

  it("omits the deviceId claim when none is provided", async () => {
    const result = await sdk.login({ email: "a@b.com", password: "secret123" });
    const session = await sdk.verifySession(result.sessionToken);
    expect(session?.deviceId).toBeNull();
  });
});
