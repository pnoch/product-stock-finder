import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { Home } from "../src/pages/Home";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn(),
  getAlerts: vi.fn(),
  getSettings: vi.fn(),
  getBackOrderReminders: vi.fn(),
}));

vi.mock("../src/storage", () => ({
  storage: mockStorage,
}));

function renderHome() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Home />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getWatchlist.mockResolvedValue([
    {
      id: "p1",
      name: "MikroTik hAP ac3",
      modelNumber: "hAP ac3",
      brand: "MikroTik",
      category: "Router",
      description: "",
      addedAt: new Date().toISOString(),
      isWatched: true,
      listings: [],
    },
  ]);
  mockStorage.getAlerts.mockResolvedValue([]);
  mockStorage.getSettings.mockResolvedValue({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
  });
  mockStorage.getBackOrderReminders.mockResolvedValue([]);
});

describe("home manual refresh", () => {
  it("refreshes the dashboard on demand", async () => {
    renderHome();
    const refreshButton = await screen.findByRole("button", {
      name: /refresh dashboard/i,
    });
    await waitFor(() =>
      expect(mockStorage.getBackOrderReminders).toHaveBeenCalled(),
    );
    const callsBefore = mockStorage.getBackOrderReminders.mock.calls.length;
    mockStorage.getBackOrderReminders.mockClear();
    mockStorage.getWatchlist.mockClear();
    await userEvent.click(refreshButton);
    await waitFor(() =>
      expect(mockStorage.getBackOrderReminders).toHaveBeenCalled(),
    );
    expect(mockStorage.getWatchlist).toHaveBeenCalled();
    expect(callsBefore).toBeGreaterThanOrEqual(1);
  });
});
