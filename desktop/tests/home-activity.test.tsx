import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Home } from "../src/pages/Home";
import { RestockWatches } from "../src/pages/RestockWatches";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn(),
  getAlerts: vi.fn(),
  getSettings: vi.fn(),
  getBackOrderReminders: vi.fn(),
  getStockWatches: vi.fn(),
  removeStockWatch: vi.fn(),
}));

vi.mock("../src/storage", () => ({
  storage: mockStorage,
}));

vi.mock("../src/hooks/use-connection", () => ({
  useConnection: () => ({
    status: "signed-out",
    reachable: false,
    isRefreshing: false,
    lastCheckedAt: null,
    refetch: () => {},
  }),
}));

function makeListing(
  productId: string,
  distributorId: string,
  lastChecked: string,
) {
  return {
    distributorId,
    productId,
    price: 100,
    currency: "USD",
    stockStatus: "in_stock" as const,
    url: "https://example.com",
    lastChecked,
    priceHistory: [],
  };
}

function makeProduct(
  id: string,
  name: string,
  listings: ReturnType<typeof makeListing>[],
) {
  return {
    id,
    name,
    modelNumber: `model-${id}`,
    brand: "Brand",
    category: "Router",
    description: "",
    addedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    isWatched: true,
    listings,
  };
}

const FRESH = new Date("2026-09-10T12:00:00Z").toISOString();
const STALE = new Date("2026-01-01T00:00:00Z").toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getAlerts.mockResolvedValue([]);
  mockStorage.getSettings.mockResolvedValue({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
  });
  mockStorage.getBackOrderReminders.mockResolvedValue([]);
  mockStorage.getStockWatches.mockResolvedValue([]);
});

describe("home recent activity", () => {
  it("shows five distinct products in recent activity", async () => {
    const dominant = makeProduct(
      "p-dominant",
      "Dominant Product",
      ["d1", "d2", "d3", "d4", "d5"].map((d) =>
        makeListing("p-dominant", d, FRESH),
      ),
    );
    const others = ["p-b", "p-c", "p-d", "p-e", "p-f"].map((id, i) =>
      makeProduct(id, `Stale Product ${i}`, [
        makeListing(id, "d1", STALE),
      ]),
    );
    mockStorage.getWatchlist.mockResolvedValue([dominant, ...others]);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Home />
      </MemoryRouter>,
    );

    const heading = await screen.findByRole("heading", {
      name: /recent activity/i,
    });
    expect(heading).toBeInTheDocument();

    await waitFor(() => {
      const activityLinks = screen.getAllByRole("link", {
        name: / at .* details$/i,
      });
      expect(activityLinks).toHaveLength(5);
    });

    const activityLinks = screen.getAllByRole("link", {
      name: / at .* details$/i,
    });
    const names = activityLinks.map((l) => l.getAttribute("aria-label") ?? "");
    const distinctProducts = new Set(
      names.map((n) => n.replace(/^View /, "").split(" at ")[0]),
    );
    expect(distinctProducts.size).toBe(5);
    const dominantCount = names.filter((n) =>
      n.includes("Dominant Product"),
    ).length;
    expect(dominantCount).toBe(1);
    void within;
  });
});

describe("restock empty state", () => {
  it("restock empty state links to search", async () => {
    mockStorage.getStockWatches.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={["/restock"]}>
        <RestockWatches />
      </MemoryRouter>,
    );

    const cta = await screen.findByRole("link", {
      name: /browse products/i,
    });
    expect(cta).toHaveAttribute("href", "/search");
    expect(
      screen.queryByRole("link", { name: /browse watchlist/i }),
    ).not.toBeInTheDocument();
  });
});
