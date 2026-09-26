import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(async () => {}),
}));

import * as db from "../server/db";
import { sdk } from "../server/_core/sdk";

function makeReq(token: string) {
  return { headers: { authorization: `Bearer ${token}` } } as never;
}

describe("credential-change epoch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a token minted before the account's last credential change", async () => {
    const stale = await sdk.createSessionToken("open_1", {
      name: "U",
      credentialsChangedAt: 0,
    });
    vi.mocked(db.getUserByOpenId).mockResolvedValue({
      id: 1,
      openId: "open_1",
      name: "U",
      credentialsChangedAt: 1_700_000_000_000,
    } as never);
    await expect(sdk.authenticateRequest(makeReq(stale))).rejects.toThrow(
      /expired/i,
    );
  });

  it("accepts a token minted under the current epoch", async () => {
    const fresh = await sdk.createSessionToken("open_1", {
      name: "U",
      credentialsChangedAt: 1_700_000_000_000,
    });
    vi.mocked(db.getUserByOpenId).mockResolvedValue({
      id: 1,
      openId: "open_1",
      name: "U",
      credentialsChangedAt: 1_700_000_000_000,
    } as never);
    await expect(sdk.authenticateRequest(makeReq(fresh))).resolves.toMatchObject(
      { openId: "open_1" },
    );
  });

  it("rejects a legacy token with no epoch once the account changed credentials", async () => {
    // Tokens minted before the claim existed carry no cca; they must be treated
    // as epoch 0 rather than surviving indefinitely.
    const legacy = await sdk.signSession({
      openId: "open_1",
      appId: "app",
      name: "U",
    });
    vi.mocked(db.getUserByOpenId).mockResolvedValue({
      id: 1,
      openId: "open_1",
      name: "U",
      credentialsChangedAt: 1_700_000_000_000,
    } as never);
    await expect(sdk.authenticateRequest(makeReq(legacy))).rejects.toThrow(
      /expired/i,
    );
  });

  it("accepts a token when the account has never changed credentials", async () => {
    const token = await sdk.createSessionToken("open_1", { name: "U" });
    vi.mocked(db.getUserByOpenId).mockResolvedValue({
      id: 1,
      openId: "open_1",
      name: "U",
      credentialsChangedAt: 0,
    } as never);
    await expect(sdk.authenticateRequest(makeReq(token))).resolves.toMatchObject(
      { openId: "open_1" },
    );
  });
});
