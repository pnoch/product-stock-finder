import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { Compare } from "../src/pages/Compare";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn(),
  getSettings: vi.fn(),
  addAlert: vi.fn(),
}));

vi.mock("../src/storage", () => ({
  storage: mockStorage,
}));

function listing(distributorId: string, price: number, currency: string, stockStatus: "in_stock" | "out_of_stock") {
  return {
    distributorId,
    productId: "p1",
    price,
    currency,
    stockStatus,
    url: `https://example.com/${distributorId}`,
    lastChecked: new Date().toISOString(),
    priceHistory: [
      { price: price + 10, currency, date: "2026-06-01T00:00:00.000Z" },
      { price, currency, date: "2026-09-01T00:00:00.000Z" },
    ],
  };
}

const regionProduct = {
  id: "p1",
  name: "MikroTik CRS326",
  modelNumber: "CRS326-24G",
  brand: "MikroTik",
  category: "Switch",
  description: "24-port switch",
  addedAt: new Date().toISOString(),
  isWatched: true,
  listings: [
    listing("balticnetworks-us", 100, "USD", "in_stock"),
    listing("linktechs-us", 90, "USD", "out_of_stock"),
    listing("linitx-uk", 80, "EUR", "in_stock"),
  ],
};

const emptyProduct = {
  ...regionProduct,
  listings: [
    listing("balticnetworks-us", 90, "USD", "out_of_stock"),
    listing("linitx-uk", 80, "EUR", "out_of_stock"),
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

beforeEach(() => {
  vi.clearAllMocks();
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

describe("cheapest by region card", () => {
  it("lists cheapest in-stock per region with overall best marked", async () => {
    mockStorage.getWatchlist.mockResolvedValue([regionProduct]);
    renderCompare();

    expect(await screen.findByText("Cheapest by Region")).toBeTruthy();
    const card = screen.getByText("Cheapest by Region").closest("div") as HTMLElement;
    const q = within(card);
    expect(q.getByText("North America")).toBeTruthy();
    expect(q.getByText("Europe")).toBeTruthy();
    expect(q.getByText("Baltic Networks")).toBeTruthy();
    expect(q.getByText("Linitx")).toBeTruthy();
    // Out-of-stock $90 listing is skipped: North America shows the $100 in-stock row
    expect(q.getByText("$100.00")).toBeTruthy();
    // €80 → ≈ $86.96 converted, overall cheapest
    expect(q.getByText(/\$86\.96/)).toBeTruthy();
    expect(q.getByText("BEST")).toBeTruthy();
    // BEST badge sits on the overall-cheapest (Europe) row
    expect(q.getByText("BEST").closest("div")?.textContent).toContain("Europe");

    // Cheapest-first order: Europe (≈$86.96) before North America ($100)
    const body = card.textContent ?? "";
    expect(body.indexOf("Europe")).toBeLessThan(body.indexOf("North America"));
  });

  it("shows native price alongside converted", async () => {
    mockStorage.getWatchlist.mockResolvedValue([regionProduct]);
    renderCompare();

    expect(await screen.findByText("Cheapest by Region")).toBeTruthy();
    const card = screen.getByText("Cheapest by Region").closest("div") as HTMLElement;
    const body = card.textContent ?? "";
    // Europe row: €80 native + ≈ $86.96 converted (fixture's real numbers)
    expect(body).toContain("€80.00");
    expect(body).toContain("$86.96");
    expect(body).toContain("≈");
  });

  it("shows the empty state with no buyable listings", async () => {
    mockStorage.getWatchlist.mockResolvedValue([emptyProduct]);
    renderCompare();

    expect(await screen.findByText("Cheapest by Region")).toBeTruthy();
    expect(screen.getByText("No in-stock regions")).toBeTruthy();
  });
});
