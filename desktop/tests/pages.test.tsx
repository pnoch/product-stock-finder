// desktop/tests/pages.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Home } from "../src/pages/Home";
import { Settings } from "../src/pages/Settings";

// Mock storage module
const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn().mockResolvedValue([
    {
      id: "p1",
      name: "MikroTik hAP ac³",
      modelNumber: "hAP ac³",
      brand: "MikroTik",
      category: "Router",
      description: "Dual-band router",
      addedAt: new Date().toISOString(),
      isWatched: true,
      listings: [],
    },
  ]),
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

function renderHomeWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <Home />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

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

describe("Home page", () => {
  beforeEach(() => {
    mockStorage.getWatchlist.mockClear();
    mockStorage.getAlerts.mockClear();
    mockStorage.getWatchlist.mockResolvedValue([
      {
        id: "p1",
        name: "MikroTik hAP ac³",
        modelNumber: "hAP ac³",
        brand: "MikroTik",
        category: "Router",
        description: "Dual-band router",
        addedAt: new Date().toISOString(),
        isWatched: true,
        listings: [],
      },
    ]);
    mockStorage.getAlerts.mockResolvedValue([]);
  });

  it("renders dashboard title", async () => {
    const queryClient = renderHomeWithProviders();
    try {
      await waitFor(() => {
        expect(screen.getByText("Dashboard")).toBeInTheDocument();
      });
    } finally {
      queryClient.clear();
    }
  });

  it("shows stat cards", async () => {
    const queryClient = renderHomeWithProviders();
    try {
      await waitFor(() => {
        expect(screen.getByText("Total Tracked")).toBeInTheDocument();
        expect(screen.getByText("In Stock")).toBeInTheDocument();
        expect(screen.getByText("Alerts Active")).toBeInTheDocument();
        expect(screen.getByText("Reminders")).toBeInTheDocument();
      });
    } finally {
      queryClient.clear();
    }
  });
});

describe("Settings page", () => {
  beforeEach(() => {
    mockStorage.getSettings.mockClear();
    mockStorage.getSettings.mockResolvedValue({
      theme: "auto",
      displayCurrency: "USD",
      checkInterval: "manual",
      notificationsEnabled: true,
      stockAlerts: true,
      priceAlerts: true,
    });
  });

  it("renders settings title", async () => {
    const queryClient = renderSettingsWithProviders();
    try {
      await waitFor(() => {
        expect(screen.getByText("Settings")).toBeInTheDocument();
      });
    } finally {
      queryClient.clear();
    }
  });

  it("shows theme section", async () => {
    const queryClient = renderSettingsWithProviders();
    try {
      await waitFor(() => {
        expect(screen.getByText("Theme")).toBeInTheDocument();
      });
    } finally {
      queryClient.clear();
    }
  });

  it("shows currency section", async () => {
    const queryClient = renderSettingsWithProviders();
    try {
      await waitFor(() => {
        expect(screen.getByText("Display Currency")).toBeInTheDocument();
      });
    } finally {
      queryClient.clear();
    }
  });
});
