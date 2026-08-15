import { describe, expect, it } from "vitest";
import { encodeOAuthState, decodeOAuthState } from "../shared/oauth-state";

describe("oauth-state", () => {
  it("round-trips redirectUri and deviceId", () => {
    const state = encodeOAuthState("http://localhost:8081/oauth/callback", "dev-1");
    expect(decodeOAuthState(state)).toEqual({
      redirectUri: "http://localhost:8081/oauth/callback",
      deviceId: "dev-1",
    });
  });

  it("round-trips without a deviceId", () => {
    const state = encodeOAuthState("http://localhost:8081/oauth/callback");
    expect(decodeOAuthState(state)).toEqual({
      redirectUri: "http://localhost:8081/oauth/callback",
      deviceId: undefined,
    });
  });

  it("decodes a legacy plain-base64 state", () => {
    const legacy = btoa("http://localhost:8081/oauth/callback");
    expect(decodeOAuthState(legacy)).toEqual({
      redirectUri: "http://localhost:8081/oauth/callback",
      deviceId: undefined,
    });
  });
});
