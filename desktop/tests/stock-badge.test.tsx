import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StockBadge } from "../src/components/StockBadge";

afterEach(cleanup);

describe("StockBadge expected date", () => {
  it("renders the raw expected date for a back order (no reformatting)", () => {
    // Mobile renders the value verbatim; the desktop used to parse it through
    // `new Date` and normalize "Sept"→"Sep".
    render(<StockBadge status="back_order" expectedDate="Sept 15, 2026" />);
    expect(screen.getByText(/Back Order · Sept 15, 2026/)).toBeTruthy();
  });

  it("does not fabricate a day for a month-only expected date", () => {
    render(<StockBadge status="back_order" expectedDate="Aug 2026" />);
    expect(screen.getByText(/Back Order · Aug 2026/)).toBeTruthy();
    expect(screen.queryByText(/Aug 1, 2026/)).toBeNull();
  });

  it("omits the expected date for non-back-order statuses", () => {
    render(<StockBadge status="in_stock" expectedDate="Sept 15, 2026" />);
    expect(screen.queryByText(/Sept 15, 2026/)).toBeNull();
  });
});
