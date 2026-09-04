import { describe, expect, it } from "vitest";
import { parseOAuthCallbackParams } from "../lib/oauth-callback";

describe("OAuth callback params", () => {
  it("parses a native OAuth callback into a session", () => {
    const user = { id: 1, openId: "open-1" };
    expect(
      parseOAuthCallbackParams({
        sessionToken: "sess-token",
        user: JSON.stringify(user),
      }),
    ).toEqual({ action: "authenticated", sessionToken: "sess-token", user });
  });

  it("rejects an OAuth callback without a session token", () => {
    expect(parseOAuthCallbackParams({})).toEqual({ action: "redirect", to: "/" });
  });
});
