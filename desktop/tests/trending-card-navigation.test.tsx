import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router";
import { TrendingSection } from "../src/components/TrendingSection";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn(),
  addToWatchlist: vi.fn(),
}));

vi.mock("../src/storage", () => ({ storage: mockStorage }));

vi.mock("@shared/trending", () => ({
  fetchTrending: vi.fn(async () => [
    {
      id: "nvidia-rtx-5090",
      name: "NVIDIA RTX 5090",
      brand: "NVIDIA",
      category: "GPU",
      estimatedPrice: 2000,
      currency: "USD",
      reason: "Flagship GPU sells out within minutes of restocking",
      source: "static",
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
  ]),
}));

vi.mock("../src/components/ProductImage", () => ({
  ProductImage: () => <div data-testid="product-image" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getWatchlist.mockResolvedValue([]);
  mockStorage.addToWatchlist.mockResolvedValue(undefined);
});

describe("desktop trending card", () => {
  it("adds the product before navigating to its detail", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<TrendingSection />} />
          <Route path="/product/:id" element={<div>Product detail page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    const link = await screen.findByRole("link", {
      name: /view nvidia rtx 5090 details/i,
    });
    await userEvent.click(link);

    // The product must be added first, or the detail screen (which reads the
    // watchlist) renders "Product not found".
    await waitFor(() =>
      expect(mockStorage.addToWatchlist).toHaveBeenCalledWith(
        expect.objectContaining({ id: "nvidia-rtx-5090" }),
      ),
    );
    expect(await screen.findByText("Product detail page")).toBeInTheDocument();
  });
});
