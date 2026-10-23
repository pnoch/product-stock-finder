// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PriceAlert, Product } from "../lib/types";

const state = vi.hoisted(() => ({
  updateAlert: vi.fn(async () => {}),
  reject: false,
}));

vi.mock("../desktop/src/storage", () => ({
  storage: {
    updateAlert: (...args: unknown[]) => state.updateAlert(...args),
  },
}));

import { useAlertEdit } from "../desktop/src/hooks/use-alert-edit";

const alert: PriceAlert = {
  id: "a1",
  productId: "p1",
  distributorId: "server2u-my",
  targetPrice: 100,
  currency: "USD",
  direction: "drop",
  createdAt: "2026-01-01T00:00:00.000Z",
  isActive: true,
};

const product: Product = {
  id: "p1",
  name: "Test",
  modelNumber: "T-1",
  brand: "Brand",
  category: "Router",
  description: "",
  addedAt: "2026-01-01T00:00:00.000Z",
  isWatched: true,
  listings: [
    {
      distributorId: "server2u-my",
      productId: "p1",
      price: 120,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      lastChecked: "2026-02-01T00:00:00.000Z",
      priceHistory: [],
    },
  ],
};

describe("useAlertEdit", () => {
  beforeEach(() => {
    state.updateAlert.mockClear();
    state.reject = false;
    state.updateAlert.mockImplementation(async () => {
      if (state.reject) throw new Error("quota");
    });
  });

  function setup() {
    const showToast = vi.fn();
    const refreshAlerts = vi.fn();
    const hook = renderHook(() =>
      useAlertEdit({
        watchlistProducts: [product],
        showToast,
        refreshAlerts,
      }),
    );
    return { ...hook, showToast, refreshAlerts };
  }

  it("populates the form from the alert", () => {
    const { result } = setup();
    act(() => result.current.handleEditAlert(alert));
    expect(result.current.editingAlert?.id).toBe("a1");
    expect(result.current.editPrice).toBe("100");
    expect(result.current.editCurrency).toBe("USD");
    expect(result.current.editDirection).toBe("drop");
    expect(result.current.editDistributorId).toBe("server2u-my");
  });

  it("lists the product's distributors", () => {
    const { result } = setup();
    act(() => result.current.handleEditAlert(alert));
    expect(result.current.editDistributors).toHaveLength(1);
    expect(result.current.editDistributors[0]!.id).toBe("server2u-my");
  });

  it("rejects a non-positive price", async () => {
    const { result } = setup();
    act(() => result.current.handleEditAlert(alert));
    act(() => result.current.setEditPrice("0"));
    await act(async () => {
      await result.current.handleSaveEdit();
    });
    expect(result.current.editError).toBe("Please enter a valid target price.");
    expect(state.updateAlert).not.toHaveBeenCalled();
  });

  it("saves and refreshes on success", async () => {
    const { result, showToast, refreshAlerts } = setup();
    act(() => result.current.handleEditAlert(alert));
    act(() => result.current.setEditPrice("90"));
    await act(async () => {
      await result.current.handleSaveEdit();
    });
    expect(state.updateAlert).toHaveBeenCalledWith("a1", {
      targetPrice: 90,
      currency: "USD",
      direction: "drop",
      distributorId: "server2u-my",
    });
    expect(showToast).toHaveBeenCalledWith("Alert updated");
    expect(refreshAlerts).toHaveBeenCalledTimes(1);
    expect(result.current.editingAlert).toBeNull();
  });

  it("keeps the dialog open and reports a save failure", async () => {
    state.reject = true;
    const { result, refreshAlerts } = setup();
    act(() => result.current.handleEditAlert(alert));
    await act(async () => {
      await result.current.handleSaveEdit();
    });
    expect(result.current.editError).toBe(
      "Couldn't save your changes. Please try again.",
    );
    expect(result.current.editingAlert?.id).toBe("a1");
    expect(refreshAlerts).not.toHaveBeenCalled();
  });
});
