import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PriceHistoryChart } from "../src/components/PriceHistoryChart";

const history = [
  { date: "2026-08-01", price: 100, currency: "USD", stockStatus: "in_stock" },
  { date: "2026-09-01", price: 90, currency: "USD", stockStatus: "in_stock" },
];

describe("price history chart", () => {
  it("renders converted points with currency tick labels", () => {
    const { container } = render(
      <PriceHistoryChart history={history as never} displayCurrency="USD" />,
    );
    expect(container.querySelector("svg.recharts-surface")).not.toBeNull();
    expect(container.querySelector("path.recharts-line-curve")).not.toBeNull();
    expect(container.textContent).toMatch(/\$\d+/);
  });

  it("drops unknown-currency points instead of rendering $0", () => {
    const { container } = render(
      <PriceHistoryChart
        history={[
          { date: "2026-08-01", price: 100, currency: "USD", stockStatus: "in_stock" },
          { date: "2026-09-01", price: 400, currency: "XXY", stockStatus: "in_stock" },
        ] as never}
        displayCurrency="USD"
      />,
    );
    // Dropped point's date label vanishes; kept point remains; no $0.00 value.
    // (Y-axis $0 floor tick is recharts domain behavior, not a data point.)
    expect(container.textContent).not.toContain("Sep 1");
    expect(container.textContent).toContain("Aug 1");
    expect(container.textContent).not.toContain("$0.00");
  });

  it("shows empty state when every point is unconvertible", () => {
    const { getByText } = render(
      <PriceHistoryChart
        history={[{ date: "2026-09-01", price: 400, currency: "XXY", stockStatus: "in_stock" }] as never}
        displayCurrency="USD"
      />,
    );
    expect(getByText("No data")).toBeTruthy();
  });
});
