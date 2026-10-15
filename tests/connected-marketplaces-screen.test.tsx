// @vitest-environment jsdom
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import React from "react";

const searchFbMarketplace = vi.hoisted(() => vi.fn());
vi.mock("@/lib/marketplace/fb-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/marketplace/fb-search")>();
  return { ...actual, searchFbMarketplace };
});

const listeners = vi.hoisted(() => new Set<(event: unknown) => void>());
const preferences = vi.hoisted(() => ({
  requestedArea: "Bangkok",
  requestedRadiusKm: 64 as const,
}));
vi.mock("@/lib/marketplace/connections", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/marketplace/connections")>();
  return {
    ...actual,
    getMarketplaceConnectionsService: () => ({
      load: async () => {},
      preferences: () => preferences,
      subscribe: (listener: (event: unknown) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    }),
  };
});

vi.mock("react-native", async () => {
  const React = await import("react");
  const strip = (s: unknown): unknown => (typeof s === "function" ? strip((s as any)({ pressed: false })) : s);
  return {
    ActivityIndicator: () => React.createElement("div"),
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
    TouchableOpacity: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress, style: strip(r.style) }, children),
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ surface: "#fff", foreground: "#111", muted: "#888", border: "#ddd", primary: "#0F52BA", warning: "#F59E0B" }),
}));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("expo-linking", () => ({ openURL: vi.fn(async () => {}) }));

import { FacebookResultsSection } from "@/components/search/facebook-results-section";

function emit(event: unknown) {
  for (const listener of listeners) listener(event);
}

describe("FacebookResultsSection reconnect retry", () => {
  beforeEach(() => {
    listeners.clear();
    searchFbMarketplace.mockReset();
    searchFbMarketplace.mockResolvedValue({ kind: "empty" });
  });
  afterEach(() => cleanup());

  it("retries the retained query exactly once on a matching ready event", async () => {
    render(<FacebookResultsSection query="mac pro" onTrack={() => {}} />);
    await waitFor(() => expect(searchFbMarketplace).toHaveBeenCalledTimes(1));

    emit({
      type: "verification",
      site: "facebook",
      verification: {
        kind: "ready",
        checkedAt: "2026-10-13T00:00:00.000Z",
        capability: { kind: "search", query: "mac pro" },
      },
    });
    await waitFor(() => expect(searchFbMarketplace).toHaveBeenCalledTimes(2));

    // Same verification timestamp must not trigger a second retry.
    emit({
      type: "verification",
      site: "facebook",
      verification: {
        kind: "ready",
        checkedAt: "2026-10-13T00:00:00.000Z",
        capability: { kind: "search", query: "mac pro" },
      },
    });
    await new Promise((r) => setTimeout(r, 700));
    expect(searchFbMarketplace).toHaveBeenCalledTimes(2);
  });

  it("ignores ready events for a different query", async () => {
    render(<FacebookResultsSection query="mac pro" onTrack={() => {}} />);
    await waitFor(() => expect(searchFbMarketplace).toHaveBeenCalledTimes(1));

    emit({
      type: "verification",
      site: "facebook",
      verification: {
        kind: "ready",
        checkedAt: "2026-10-13T00:00:00.000Z",
        capability: { kind: "search", query: "laptop" },
      },
    });
    await new Promise((r) => setTimeout(r, 700));
    expect(searchFbMarketplace).toHaveBeenCalledTimes(1);
  });

  it("does not retry on a failed (non-ready) verification", async () => {
    render(<FacebookResultsSection query="mac pro" onTrack={() => {}} />);
    await waitFor(() => expect(searchFbMarketplace).toHaveBeenCalledTimes(1));

    emit({
      type: "verification",
      site: "facebook",
      verification: { kind: "login_required", checkedAt: "2026-10-13T00:00:00.000Z" },
    });
    await new Promise((r) => setTimeout(r, 700));
    expect(searchFbMarketplace).toHaveBeenCalledTimes(1);
  });
});

describe("FacebookResultsSection unavailable state", () => {
  beforeEach(() => {
    listeners.clear();
    searchFbMarketplace.mockReset();
  });
  afterEach(() => cleanup());

  it("shows guidance with Connect instead of vanishing when the check fails", async () => {
    searchFbMarketplace.mockResolvedValue({ kind: "unavailable" });
    render(<FacebookResultsSection query="mac pro" onTrack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/couldn't be checked right now/i)).toBeTruthy();
    });
    expect(screen.getByLabelText("Connect Facebook")).toBeTruthy();
  });

  it("renders nothing for a verified empty result (no noise)", async () => {
    searchFbMarketplace.mockResolvedValue({ kind: "empty" });
    render(<FacebookResultsSection query="mac pro" onTrack={() => {}} />);
    await waitFor(() => expect(searchFbMarketplace).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByLabelText("Connect Facebook")).toBeNull();
  });
});
