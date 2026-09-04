import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { Rates } from "../src/pages/Rates";
import { Search } from "../src/pages/Search";
import { Watchlist } from "../src/pages/Watchlist";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn(),
  getSettings: vi.fn(),
  getFxHistory: vi.fn(),
  getDiscoveredProducts: vi.fn(),
  addToWatchlist: vi.fn(),
  removeFromWatchlist: vi.fn(),
}));

vi.mock("../src/storage", () => ({ storage: mockStorage }));

beforeEach(() => {
  mockStorage.getWatchlist.mockResolvedValue([]);
  mockStorage.getSettings.mockResolvedValue({ displayCurrency: "USD" });
  mockStorage.getFxHistory.mockResolvedValue(null);
  mockStorage.getDiscoveredProducts.mockResolvedValue([]);
});

describe("desktop parity pages", () => {
  it("renders the Rates exchange grid and refresh control", async () => {
    render(
      <MemoryRouter>
        <Rates />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText("Exchange Rates")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Refresh rates")).toBeInTheDocument();
  });

  it("supports bulk-select mode on Watchlist", async () => {
    render(
      <MemoryRouter>
        <Watchlist />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText("Enter bulk select mode"));
    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });
  });

  it("searches the shared catalog through the desktop page", async () => {
    render(
      <MemoryRouter>
        <Search />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Search products"), {
      target: { value: "CRS804" },
    });
    await waitFor(() => {
      expect(screen.getByText(/result/i)).toBeInTheDocument();
    });
  });
});
