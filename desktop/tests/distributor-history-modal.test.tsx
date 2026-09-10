import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { readFile } from "node:fs/promises";
import { DistributorHistoryModal } from "../src/components/DistributorHistoryModal";

const listing = {
  distributorId: "d1",
  productId: "p1",
  price: 90,
  currency: "USD",
  stockStatus: "in_stock",
  url: "https://example.com/p1",
  lastChecked: "2026-09-01",
  priceHistory: [
    { date: "2026-08-01", price: 100, currency: "USD", stockStatus: "in_stock" },
    { date: "2026-09-01", price: 90, currency: "USD", stockStatus: "in_stock" },
  ],
};

describe("distributor history modal", () => {
  it("renders the listing chart and downloads CSV", async () => {
    if (typeof URL.createObjectURL !== "function") {
      Object.defineProperty(URL, "createObjectURL", {
        writable: true,
        value: vi.fn(() => "blob:mock"),
      });
    }
    if (typeof URL.revokeObjectURL !== "function") {
      Object.defineProperty(URL, "revokeObjectURL", {
        writable: true,
        value: vi.fn(),
      });
    }
    const clicked: HTMLAnchorElement[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this);
      });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    try {
      render(
        <MemoryRouter>
          <DistributorHistoryModal
            open
            onClose={() => {}}
            productId="p1"
            productName="Widget"
            listing={listing as never}
            distributorName="Dist One"
            displayCurrency="USD"
          />
        </MemoryRouter>,
      );
      expect(screen.getByText(/dist one/i)).toBeInTheDocument();
      expect(document.querySelector("svg.recharts-surface")).not.toBeNull();
      await userEvent.click(screen.getByRole("button", { name: /download csv/i }));
      await waitFor(() => expect(clickSpy).toHaveBeenCalled());
      expect(clicked.length).toBeGreaterThan(0);
      expect(clicked[0].download).toContain("p1-d1-history.csv");
      expect(clicked[0].href).toContain("blob:mock");
    } finally {
      clickSpy.mockRestore();
      vi.restoreAllMocks();
    }
  });

  it("links to the full comparison for the distributor", () => {
    render(
      <MemoryRouter>
        <DistributorHistoryModal
          open
          onClose={() => {}}
          productId="p1"
          productName="Widget"
          listing={listing as never}
          distributorName="Dist One"
          displayCurrency="USD"
        />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /full comparison/i });
    expect(link.getAttribute("href")).toBe("/compare/p1?distributor=d1");
  });

  it("wires the modal from listing rows with >=2-point gating", async () => {
    const text = await readFile("src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("DistributorHistoryModal");
    expect(text).toContain("priceHistory.length >= 2");
    expect(text).toContain("setHistoryFor");
  });
});
