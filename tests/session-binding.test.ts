import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.JWT_SECRET = "test-secret";
  process.env.VITE_APP_ID = "test-app";
});

import { sdk } from "../server/_core/sdk";

describe("session device binding", () => {
  it("round-trips a deviceId through createSessionToken and verifySession", async () => {
    const token = await sdk.createSessionToken("open-1", {
      name: "U",
      deviceId: "dev-1",
    });
    const session = await sdk.verifySession(token);
    expect(session).toMatchObject({ openId: "open-1", deviceId: "dev-1" });
  });

  it("returns deviceId null for a token without a claim", async () => {
    const token = await sdk.createSessionToken("open-1", { name: "U" });
    const session = await sdk.verifySession(token);
    expect(session?.deviceId).toBeNull();
  });

  it("signs and verifies a legacy payload without deviceId", async () => {
    const token = await sdk.signSession({
      openId: "open-1",
      appId: "app",
      name: "U",
    });
    const session = await sdk.verifySession(token);
    expect(session?.deviceId).toBeNull();
  });
});
