import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useSearchParams } from "react-router";
import { Home } from "../src/pages/Home";
import { RestockWatches } from "../src/pages/RestockWatches";
import { formatLastRefreshed } from "../../lib/last-refreshed";

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
  });

  it("renders listing-less products in activity", async () => {
    const good = makeProduct("p-good", "Good Product", [
      makeListing("p-good", "d1", FRESH),
    ]);
    const empty = makeProduct("p-empty", "Empty Product", []);
    mockStorage.getWatchlist.mockResolvedValue([empty, good]);

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
      expect(activityLinks).toHaveLength(2);
    });

    const names = screen
      .getAllByRole("link", { name: / at .* details$/i })
      .map((l) => l.getAttribute("aria-label") ?? "");
    expect(names.some((n) => n.includes("Empty Product"))).toBe(true);
    expect(names.some((n) => n.includes("Good Product"))).toBe(true);

    // Null row keeps its product link, shows unknown status + added-at time.
    const emptyLink = screen.getByRole("link", {
      name: "View Empty Product at unknown details",
    });
    expect(emptyLink).toHaveAttribute("href", "/product/p-empty");
    expect(emptyLink).toHaveTextContent("Unknown");
    expect(emptyLink).toHaveTextContent(formatLastRefreshed(empty.addedAt));
  });
});

describe("home stat card links", () => {
  function Probe({ label }: { label: string }) {
    const [params] = useSearchParams();
    return <div>{`${label}:${params.toString() || "none"}`}</div>;
  }

  it("stat cards link with params", async () => {
    const good = makeProduct("p-good", "Good Product", [
      makeListing("p-good", "d1", FRESH),
    ]);
    mockStorage.getWatchlist.mockResolvedValue([good]);
    const cases = [
      { card: "Total Tracked", path: "watchlist", expected: "none" },
      { card: "In Stock", path: "watchlist", expected: "inStock=1" },
      { card: "Alerts Active", path: "alerts", expected: "tab=alerts" },
      { card: "Reminders", path: "alerts", expected: "tab=reminders" },
    ];
    for (const c of cases) {
      const { unmount } = render(
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/watchlist" element={<Probe label="watchlist" />} />
            <Route path="/alerts" element={<Probe label="alerts" />} />
          </Routes>
        </MemoryRouter>,
      );
      const button = await screen.findByRole("button", { name: c.card });
      await userEvent.click(button);
      await waitFor(() =>
        expect(
          screen.getByText(`${c.path}:${c.expected}`),
        ).toBeInTheDocument(),
      );
      unmount();
    }
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
