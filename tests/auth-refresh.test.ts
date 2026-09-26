import { describe, expect, it, vi } from "vitest";
import { fetchCurrentUser } from "../lib/auth-refresh";

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

describe("fetchCurrentUser", () => {
  it("maps the server user and coerces emailVerified", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        user: {
          id: 7,
          openId: "o7",
          name: "Test",
          email: "t@example.com",
          loginMethod: "email",
          lastSignedIn: "2026-01-01T00:00:00.000Z",
          emailVerified: true,
        },
      }),
    ) as unknown as typeof fetch;
    const user = await fetchCurrentUser("https://api.example.com/", fetchImpl);
    expect(user).toEqual({
      id: 7,
      openId: "o7",
      name: "Test",
      email: "t@example.com",
      loginMethod: "email",
      lastSignedIn: "2026-01-01T00:00:00.000Z",
      emailVerified: true,
    });
    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.com/api/auth/me", {
      credentials: "include",
    });
  });

  it("returns null when unauthenticated or when the base url is missing", async () => {
    const unauthorized = vi.fn(async () =>
      jsonResponse({ error: "Not authenticated" }, false),
    ) as unknown as typeof fetch;
    expect(await fetchCurrentUser("https://api.example.com", unauthorized)).toBeNull();

    const unused = vi.fn() as unknown as typeof fetch;
    expect(await fetchCurrentUser("", unused)).toBeNull();
    expect(unused).not.toHaveBeenCalled();
  });

  it("returns null for a malformed payload or a thrown request", async () => {
    const malformed = vi.fn(async () =>
      jsonResponse({ user: { name: "no id" } }),
    ) as unknown as typeof fetch;
    expect(await fetchCurrentUser("https://api.example.com", malformed)).toBeNull();

    const throwing = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await fetchCurrentUser("https://api.example.com", throwing)).toBeNull();
  });
});
