// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
vi.mock("expo-router", () => ({ useLocalSearchParams: () => ({ id: "p1" }), router: { replace: vi.fn() } }));
vi.mock("@/lib/storage", () => ({
  getWatchlist: vi.fn(async () => [{ id: "p1", name: "CRS", listings: [{ distributorId: "d1", price: 100, currency: "USD", stockStatus: "in_stock", priceHistory: [] }] }]),
}));
import { useProductDetail } from "@/hooks/use-product-detail";
describe("useProductDetail", () => {
  it("loads product by id", async () => {
    const { result } = renderHook(() => useProductDetail());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.product?.id).toBe("p1");
  });
});
