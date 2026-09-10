import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn().mockResolvedValue([]),
  getAlerts: vi.fn().mockResolvedValue([]),
  getSettings: vi.fn().mockResolvedValue({ displayCurrency: "USD" }),
  getBackOrderReminders: vi.fn().mockResolvedValue([]),
  getStockWatches: vi.fn().mockResolvedValue([]),
  getNotificationHistory: vi.fn().mockResolvedValue([]),
  getUnreadNotificationCount: vi.fn().mockResolvedValue(0),
  toggleAlert: vi.fn().mockResolvedValue(undefined),
  removeAlert: vi.fn().mockResolvedValue(undefined),
  rearmAlert: vi.fn().mockResolvedValue(undefined),
  snoozeAlert: vi.fn().mockResolvedValue(undefined),
  updateAlert: vi.fn().mockResolvedValue(undefined),
  addBackOrderReminder: vi.fn().mockResolvedValue(undefined),
  removeBackOrderReminder: vi.fn().mockResolvedValue(undefined),
  removeStockWatch: vi.fn().mockResolvedValue(undefined),
  markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  markNotificationRead: vi.fn().mockResolvedValue(undefined),
  getTagDefinitions: vi.fn().mockResolvedValue({}),
  getSyncMeta: vi.fn().mockResolvedValue({ lastSyncedAt: 0, items: {} }),
  saveSettings: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/storage", () => ({ storage: mockStorage }));

import { Alerts } from "../src/pages/Alerts";

function renderAlerts() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><MemoryRouter><Alerts /></MemoryRouter></QueryClientProvider>);
  return qc;
}

const TYPES = ["price_drop", "price_rise", "restock", "reminder", "health"] as const;

beforeEach(() => { vi.clearAllMocks(); });

describe("notification rows polish", () => {
  it("shows a distinct per-type icon and relative time with absolute time as tooltip", async () => {
    const now = Date.now();
    mockStorage.getNotificationHistory.mockResolvedValue(
      TYPES.map((type, i) => ({
        id: `n-${type}`,
        type,
        title: `Title ${type} ${i}`,
        body: `Body ${type}`,
        createdAt: now - 5 * 60000,
        read: true,
      })),
    );
    const qc = renderAlerts();
    try {
      fireEvent.click(await screen.findByRole("button", { name: /show notifications/i }));
      for (const type of TYPES) {
        await waitFor(() => expect(screen.getByText(`Title ${type} ${TYPES.indexOf(type)}`)).toBeInTheDocument());
      }
      // Relative time present on every row
      const relative = await screen.findAllByText("5m ago");
      expect(relative.length).toBe(TYPES.length);
      // Absolute time preserved as title tooltip on every row
      for (const el of relative) {
        expect(el.getAttribute("title")).toBe(new Date(now - 5 * 60000).toLocaleString());
      }
      // Generic Bell-only rendering is gone from rows (tab buttons still use Bell): no row icon is the Bell glyph
      const bellInRows = document.querySelectorAll("div.space-y-2 svg.lucide-bell");
      expect(bellInRows.length).toBe(0);
      // Icons vary by type: more than one distinct per-row glyph
      const rowSvgs = Array.from(document.querySelectorAll("div.space-y-2 svg"));
      const glyphs = new Set(rowSvgs.map((s) => s.getAttribute("class")));
      expect(rowSvgs.length).toBe(TYPES.length);
      expect(glyphs.size).toBeGreaterThan(1);
    } finally {
      qc.clear();
    }
  });
});
