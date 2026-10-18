// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  maybeRefresh: vi.fn(),
  history: vi.fn(),
  feedback: vi.fn(),
}));
vi.mock("@/lib/fx", () => ({ refreshFxRates: mocks.refresh, maybeRefreshFxRates: mocks.maybeRefresh }));
vi.mock("@/lib/storage", () => ({ getFxHistory: mocks.history }));
vi.mock("@/hooks/use-colors", () => ({ useColors: () => ({ foreground: "black", muted: "gray", error: "red" }) }));
vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(), notificationAsync: mocks.feedback,
  ImpactFeedbackStyle: { Light: "light" }, NotificationFeedbackType: { Success: "success", Error: "error" },
}));
vi.mock("@/components/screen-container", () => ({ ScreenContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/rates/fx-rate-grid", () => ({ FxRateGrid: ({ currentRates }: { currentRates: Record<string, number> }) => <div>EUR rate: {currentRates.EUR}</div> }));
vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children, accessibilityRole }: { children: React.ReactNode; accessibilityRole?: string }) => <span role={accessibilityRole}>{children}</span>,
  TouchableOpacity: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => <button onClick={onPress}>{children}</button>,
  RefreshControl: ({ onRefresh }: { onRefresh: () => void }) => <button onClick={onRefresh}>Pull to refresh</button>,
  ScrollView: ({ children, refreshControl }: { children: React.ReactNode; refreshControl: React.ReactNode }) => <div>{refreshControl}{children}</div>,
}));

import RatesScreen from "../app/(tabs)/rates";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.maybeRefresh.mockResolvedValue(undefined);
  mocks.refresh.mockResolvedValue(false);
  mocks.history.mockResolvedValue({ rates: { EUR: [0.88] }, timestamps: [Date.now() - 86400000] });
});
afterEach(cleanup);

describe("Rates refresh feedback", () => {
  it("reports a failed refresh without success haptics or losing the displayed rates, then recovers", async () => {
    render(<RatesScreen />);
    await screen.findByText("EUR rate: 0.88");
    fireEvent.click(screen.getByText("Pull to refresh"));
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't refresh exchange rates");
    expect(screen.getByText("EUR rate: 0.88")).toBeTruthy();
    expect(mocks.feedback).toHaveBeenCalledWith("error");
    expect(mocks.feedback).not.toHaveBeenCalledWith("success");

    mocks.refresh.mockResolvedValue(true);
    mocks.history.mockResolvedValue({ rates: { EUR: [0.9] }, timestamps: [Date.now()] });
    fireEvent.click(screen.getByText("Pull to refresh"));
    await screen.findByText("EUR rate: 0.9");
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(mocks.feedback).toHaveBeenCalledWith("success");
  });
});
