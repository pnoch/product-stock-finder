import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { clampChartWidth, Compare } from "../src/pages/Compare";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn(),
  getSettings: vi.fn(),
  addAlert: vi.fn(),
}));

vi.mock("../src/storage", () => ({
  storage: mockStorage,
}));

const product = {
  id: "p1",
  name: "MikroTik hAP ac3",
  modelNumber: "hAP ac3",
  brand: "MikroTik",
  category: "Router",
  description: "Dual-band router",
  addedAt: new Date().toISOString(),
  isWatched: true,
  listings: [
    {
      distributorId: "balticnetworks-us",
      productId: "p1",
      price: 100,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com/us",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { price: 110, currency: "USD", date: "2026-06-01T00:00:00.000Z" },
        { price: 100, currency: "USD", date: "2026-09-01T00:00:00.000Z" },
      ],
    },
    {
      distributorId: "server2u-my",
      productId: "p1",
      price: 95,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com/my",
      lastChecked: new Date().toISOString(),
      priceHistory: [
        { price: 105, currency: "USD", date: "2026-06-01T00:00:00.000Z" },
        { price: 95, currency: "USD", date: "2026-09-01T00:00:00.000Z" },
      ],
    },
  ],
};

function renderCompare() {
  render(
    <MemoryRouter initialEntries={["/compare/p1"]}>
      <Routes>
        <Route path="/compare/:id" element={<Compare />} />
      </Routes>
    </MemoryRouter>,
  );
}

const SavedRO = (window as unknown as { ResizeObserver?: unknown }).ResizeObserver;

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getWatchlist.mockResolvedValue([product]);
  mockStorage.getSettings.mockResolvedValue({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
  });
  mockStorage.addAlert.mockResolvedValue(undefined);
});

afterEach(() => {
  (window as unknown as { ResizeObserver?: unknown }).ResizeObserver = SavedRO;
});

describe("clampChartWidth", () => {
  it("clamps below 320 up to 320", () => {
    expect(clampChartWidth(200)).toBe(320);
  });

  it("passes through 640 unchanged", () => {
    expect(clampChartWidth(640)).toBe(640);
  });

  it("clamps above 960 down to 960", () => {
    expect(clampChartWidth(2000)).toBe(960);
  });
});

describe("compare chart width", () => {
  it("falls back to 640px without ResizeObserver", async () => {
    (window as unknown as { ResizeObserver?: unknown }).ResizeObserver = undefined;
    renderCompare();
    const img = await screen.findByRole("img", { name: /price history/i });
    const svg = img.closest("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("640");
  });
});
