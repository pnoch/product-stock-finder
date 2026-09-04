import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  parseOAuthCallbackParams,
  redeemOAuthTicket,
} from "../lib/oauth-callback";

describe("parseOAuthCallbackParams", () => {
  it("rejects raw session tokens from URLs (login CSRF)", () => {
    expect(
      parseOAuthCallbackParams({
        sessionToken: "attacker-jwt",
        user: JSON.stringify({ id: 1, openId: "x" }),
      } as never),
    ).toEqual({ action: "redirect", to: "/" });
  });

  it("surfaces provider errors", () => {
    expect(
      parseOAuthCallbackParams({
        error: "access_denied",
        error_description: "user denied",
      }),
    ).toEqual({ action: "failed", message: "user denied" });
  });

  it("routes ticket callbacks to redemption", () => {
    expect(parseOAuthCallbackParams({ ticket: "ticket-123" })).toEqual({
      action: "redeem",
      ticket: "ticket-123",
    });
  });

  it("redirects home when no ticket or error is present", () => {
    expect(parseOAuthCallbackParams({})).toEqual({ action: "redirect", to: "/" });
  });
});

describe("redeemOAuthTicket", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("posts the ticket and device id to the consume endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ sessionToken: "sess-1", user: { id: 1 } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await redeemOAuthTicket("ticket-123", {
        baseUrl: "https://api.example.com",
        deviceId: "dev-1",
      });
      expect(result).toEqual({ sessionToken: "sess-1", user: { id: 1 } });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/api/auth/oauth/consume",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ ticket: "ticket-123", deviceId: "dev-1" }),
        }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("throws a readable error when redemption fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Invalid or expired ticket" }),
      }),
    );
    try {
      await expect(
        redeemOAuthTicket("bad-ticket", { baseUrl: "https://api.example.com" }),
      ).rejects.toThrow(/Invalid or expired ticket/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
