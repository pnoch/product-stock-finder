import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { StockBadge } from "../src/components/StockBadge";
import { EmptyState } from "../src/components/EmptyState";
import { LoadingSpinner } from "../src/components/LoadingSpinner";
import { TimeRangeChips } from "../src/components/TimeRangeChips";

describe("StockBadge", () => {
  it("renders In Stock status", () => {
    render(<StockBadge status="in_stock" />);
    expect(screen.getByText("In Stock")).toBeInTheDocument();
  });

  it("renders Back Order status", () => {
    render(<StockBadge status="back_order" />);
    expect(screen.getByText("Back Order")).toBeInTheDocument();
  });

  it("renders Out of Stock status", () => {
    render(<StockBadge status="out_of_stock" />);
    expect(screen.getByText("Out of Stock")).toBeInTheDocument();
  });

  it("renders Unknown status", () => {
    render(<StockBadge status="unknown" />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("renders formatted expected date when provided", () => {
    render(<StockBadge status="back_order" expectedDate="2026-01-15" />);
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState icon={null} title="No items" description="Add something" />,
    );
    expect(screen.getByText("No items")).toBeInTheDocument();
    expect(screen.getByText("Add something")).toBeInTheDocument();
  });
});

describe("LoadingSpinner", () => {
  it("renders spinner", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});

describe("TimeRangeChips", () => {
  it("renders all time range options", () => {
    render(<TimeRangeChips selected="1m" onSelect={() => {}} />);
    expect(screen.getByText("1W")).toBeInTheDocument();
    expect(screen.getByText("1M")).toBeInTheDocument();
    expect(screen.getByText("3M")).toBeInTheDocument();
    expect(screen.getByText("All")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", async () => {
    let selected = "1m";
    const { user } = renderWithUser(
      <TimeRangeChips
        selected={selected}
        onSelect={(r) => {
          selected = r;
        }}
      />,
    );
    await user.click(screen.getByText("3M"));
    expect(selected).toBe("3m");
  });
});

// Helper to render with user event
import { userEvent } from "@testing-library/user-event";
function renderWithUser(ui: React.ReactElement) {
  const user = userEvent.setup();
  return { user, ...render(ui) };
}
