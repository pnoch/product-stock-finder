import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

describe("Price History Chart", () => {
  it("renders a Recharts line chart with price data", () => {
    const data = [
      { date: "Jan 1", price: 100 },
      { date: "Jan 2", price: 95 },
      { date: "Jan 3", price: 110 },
    ];
    render(
      <ResponsiveContainer width={400} height={300}>
        <LineChart data={data}>
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="price" />
        </LineChart>
      </ResponsiveContainer>,
    );
    expect(screen.getByText("Jan 1")).toBeDefined();
    expect(screen.getByText("Jan 2")).toBeDefined();
    expect(screen.getByText("Jan 3")).toBeDefined();
  });
});
