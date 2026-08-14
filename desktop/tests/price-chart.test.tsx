import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MultiLineChart } from "../src/components/MultiLineChart";

describe("MultiLineChart", () => {
  it("renders a Recharts line chart with distributor data", () => {
    const data = [
      { date: "Jan 1", Server2U: 100, Linitx: 110 },
      { date: "Jan 2", Server2U: 95, Linitx: 105 },
      { date: "Jan 3", Server2U: 110, Linitx: 100 },
    ];
    render(
      <MultiLineChart
        data={data}
        distributors={["Server2U", "Linitx"]}
        colors={["#0F52BA", "#00C896"]}
      />,
    );
    expect(screen.getByText("Jan 1")).toBeInTheDocument();
    expect(screen.getByText("Jan 2")).toBeInTheDocument();
    expect(screen.getByText("Jan 3")).toBeInTheDocument();
    expect(screen.getByText("Server2U")).toBeInTheDocument();
    expect(screen.getByText("Linitx")).toBeInTheDocument();
  });
});
