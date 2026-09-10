import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../../lib/oauth-callback", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/oauth-callback")>();
  return { ...actual, redeemOAuthTicket: vi.fn() };
});

vi.mock("../src/lib/api-base", () => ({
  getApiBaseUrl: vi.fn(() => "https://api.test"),
  getAppId: vi.fn(() => "test-app"),
  getOAuthPortalUrl: vi.fn(() => "https://portal.test"),
}));

import { redeemOAuthTicket } from "../../lib/oauth-callback";
import { getSessionToken, getUserInfo } from "../src/hooks/use-auth";
import { OAuthCallback } from "../src/pages/OAuthCallback";

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("oauth callback", () => {
  it("redeems the ticket and signs in", async () => {
    vi.mocked(redeemOAuthTicket).mockResolvedValue({
      sessionToken: "sess-123",
      user: { id: 7, openId: "google:abc", name: "Test", email: "t@e.com", emailVerified: true },
    });
    renderAt("/oauth/callback?ticket=tick-1");
    await waitFor(() =>
      expect(redeemOAuthTicket).toHaveBeenCalledWith(
        "tick-1",
        expect.objectContaining({ baseUrl: "https://api.test" }),
      ),
    );
    await waitFor(() => expect(getSessionToken()).toBe("sess-123"));
    expect(getUserInfo()).toMatchObject({ id: 7, openId: "google:abc" });
    await waitFor(() => expect(screen.getByText("Home")).toBeInTheDocument());
  });

  it("shows provider errors without redeeming", async () => {
    renderAt("/oauth/callback?error=access_denied&error_description=Nope");
    await waitFor(() => expect(screen.getByText(/nope/i)).toBeInTheDocument());
    expect(redeemOAuthTicket).not.toHaveBeenCalled();
  });

  it("rejects an invalid user without storing a session", async () => {
    vi.mocked(redeemOAuthTicket).mockResolvedValue({
      sessionToken: "sess-1",
      user: { id: "NaN", openId: "" },
    });
    renderAt("/oauth/callback?ticket=tick-bad");
    await waitFor(() => expect(screen.getByText(/invalid user/i)).toBeInTheDocument());
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
    expect(getSessionToken()).toBeNull();
  });
});
