import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn(),
  getSettings: vi.fn(),
  getPriceDigestSnapshot: vi.fn(),
  savePriceDigestSnapshot: vi.fn(),
  getAlerts: vi.fn(),
}));

vi.mock("../src/storage", () => ({ storage: mockStorage }));

import { Stats } from "../src/pages/Stats";

const DAY_MS = 24 * 60 * 60 * 1000;
const dateDaysAgo = (n: number) =>
  new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10);

function makeProduct(
  id: string,
  name: string,
  distributorId: string,
  oldPrice: number,
  newPrice: number,
) {
  const now = new Date().toISOString();
  return {
    id,
    name,
    modelNumber: name,
    brand: "MikroTik",
    category: "Switch",
    description: "",
    addedAt: now,
    isWatched: true,
    listings: [
      {
        distributorId,
        productId: id,
        price: newPrice,
        currency: "USD",
        stockStatus: "in_stock",
        url: "https://example.com",
        lastChecked: now,
        priceHistory: [
          { date: dateDaysAgo(20), price: oldPrice, currency: "USD", stockStatus: "in_stock" },
          { date: dateDaysAgo(1), price: newPrice, currency: "USD", stockStatus: "in_stock" },
        ],
      },
    ],
  };
}

const DROP_PRODUCTS = [
  makeProduct("drop-a", "Drop Product Alpha", "balticnetworks-us", 100, 80),
  makeProduct("drop-b", "Drop Product Beta", "bhphoto-us", 100, 90),
  makeProduct("drop-c", "Drop Product Gamma", "rocnoc-us", 200, 190),
];
const GAIN_PRODUCTS = [
  makeProduct("gain-a", "Gain Product Alpha", "flytec-us", 100, 115),
  makeProduct("gain-b", "Gain Product Beta", "newegg-us", 100, 108),
];

function renderStats() {
  render(
    <MemoryRouter initialEntries={["/stats"]}>
      <Stats />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getWatchlist.mockResolvedValue([...DROP_PRODUCTS, ...GAIN_PRODUCTS]);
  mockStorage.getSettings.mockResolvedValue({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
  });
  mockStorage.getPriceDigestSnapshot.mockResolvedValue(null);
  mockStorage.savePriceDigestSnapshot.mockResolvedValue(undefined);
  mockStorage.getAlerts.mockResolvedValue([]);
});

describe("stats movers lists", () => {
  it("lists all top movers, not just the biggest", async () => {
    renderStats();
    expect(await screen.findByText("Top Drops")).toBeInTheDocument();
    expect(await screen.findByText("Top Gainers")).toBeInTheDocument();
    for (const name of [
      "Drop Product Alpha",
      "Drop Product Beta",
      "Drop Product Gamma",
      "Gain Product Alpha",
      "Gain Product Beta",
    ]) {
      expect(screen.getAllByText(name).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("refreshes stats on demand", async () => {
    renderStats();
    const refreshButton = await screen.findByRole("button", {
      name: /refresh stats/i,
    });
    await waitFor(() => expect(mockStorage.getWatchlist).toHaveBeenCalled());
    mockStorage.getWatchlist.mockClear();
    await userEvent.click(refreshButton);
    await waitFor(() => expect(mockStorage.getWatchlist).toHaveBeenCalled());
  });
});
