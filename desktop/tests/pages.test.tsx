// desktop/tests/pages.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
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
}));

vi.mock("../src/storage", () => ({
  storage: mockStorage,
}));

function renderWithRouter(ui: React.ReactElement, route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  );
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
    renderWithRouter(<Home />);
    await waitFor(() => {
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });
  });

  it("shows stat cards", async () => {
    renderWithRouter(<Home />);
    await waitFor(() => {
      expect(screen.getByText("Total Tracked")).toBeInTheDocument();
      expect(screen.getByText("In Stock")).toBeInTheDocument();
      expect(screen.getByText("Alerts Active")).toBeInTheDocument();
      expect(screen.getByText("Reminders")).toBeInTheDocument();
    });
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
    renderWithRouter(<Settings />);
    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });
  });

  it("shows theme section", async () => {
    renderWithRouter(<Settings />);
    await waitFor(() => {
      expect(screen.getByText("Theme")).toBeInTheDocument();
    });
  });

  it("shows currency section", async () => {
    renderWithRouter(<Settings />);
    await waitFor(() => {
      expect(screen.getByText("Display Currency")).toBeInTheDocument();
    });
  });
});
