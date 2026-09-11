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
});
