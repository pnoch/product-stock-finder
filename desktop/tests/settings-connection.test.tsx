// desktop/tests/settings-connection.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Settings } from "../src/pages/Settings";

// Mock storage module (mirrors the Settings trio harness in pages.test.tsx)
const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn().mockResolvedValue([]),
  getAlerts: vi.fn().mockResolvedValue([]),
  getSettings: vi.fn().mockResolvedValue({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
  }),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  getBackOrderReminders: vi.fn().mockResolvedValue([]),
  getStockWatches: vi.fn().mockResolvedValue([]),
  getSyncMeta: vi.fn().mockResolvedValue({ lastSyncedAt: 0, items: {} }),
}));

vi.mock("../src/storage", () => ({
  storage: mockStorage,
}));

type ConnectionStatus = "connected" | "signed-out" | "offline" | "local";

const mockConnectionState = vi.hoisted(() => ({
  status: "connected" as ConnectionStatus,
  lastCheckedAt: null as number | null,
}));

vi.mock("../src/hooks/use-connection", () => ({
  useConnection: () => ({
    status: mockConnectionState.status,
    reachable: mockConnectionState.status === "connected",
    isRefreshing: false,
    lastCheckedAt: mockConnectionState.lastCheckedAt,
    refetch: () => {},
  }),
}));

function renderSettingsWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/settings"]}>
        <Settings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("Settings connection explanation", () => {
  beforeEach(() => {
    mockStorage.getSettings.mockResolvedValue({
      theme: "auto",
      displayCurrency: "USD",
      checkInterval: "manual",
      notificationsEnabled: true,
      stockAlerts: true,
      priceAlerts: true,
    });
    mockConnectionState.status = "connected";
    mockConnectionState.lastCheckedAt = null;
  });

  it.each([
    ["connected", "Live price checks are active."],
    ["signed-out", "Sign in to sync prices with the backend."],
    ["offline", "Backend unreachable. Showing saved prices."],
    ["local", "Backend unreachable. Showing saved prices."],
  ] as const)("explains %s status", async (status, copy) => {
    mockConnectionState.status = status;
    mockConnectionState.lastCheckedAt = Date.now();
    const queryClient = renderSettingsWithProviders();
    try {
      await waitFor(() => {
        expect(screen.getByText(copy)).toBeInTheDocument();
      });
      expect(within((screen.getByText("Connection").closest("div") as HTMLElement)).getByText(/Last checked/)).toBeInTheDocument();
    } finally {
      queryClient.clear();
    }
  });

  it("shows Never checked without a timestamp", async () => {
    mockConnectionState.status = "connected";
    mockConnectionState.lastCheckedAt = null;
    const queryClient = renderSettingsWithProviders();
    try {
      await waitFor(() => {
        expect(screen.getByText("Live price checks are active.")).toBeInTheDocument();
      });
      expect(within((screen.getByText("Connection").closest("div") as HTMLElement)).getByText("Never checked")).toBeInTheDocument();
    } finally {
      queryClient.clear();
    }
  });
});
