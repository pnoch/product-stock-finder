// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EbaySearchResult } from "../shared/ebay-search";

const state = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/server-marketplace", () => ({ fetchEbaySearch: state.fetch }));
vi.mock("@/lib/storage", () => ({ getSettings: vi.fn(async () => ({ displayCurrency: "USD" })) }));
vi.mock("@/hooks/use-colors", () => ({ useColors: () => ({ foreground: "#111", muted: "#888", primary: "#00f", border: "#ddd", surface: "#fff" }) }));
vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Image: () => null,
    ActivityIndicator: () => <span>loading</span>,
    TouchableOpacity: ({ children, onPress, accessibilityLabel }: { children?: React.ReactNode; onPress: () => void; accessibilityLabel: string }) => <button aria-label={accessibilityLabel} onClick={onPress}>{children}</button>,
  };
});
import { EbayResultsSection } from "../components/search/ebay-results-section";

const listing = { itemId: "178212205608", title: "RTX5090", url: "https://www.ebay.com/itm/178212205608", price: 1200, currency: "USD", condition: "New", seller: "seller", shipping: null, imageUrl: null };
const result: EbaySearchResult = { kind: "results", source: "api", listings: [listing] };

async function debounce() { await act(async () => { await vi.advanceTimersByTimeAsync(700); }); }

describe("eBay inline search", () => {
  it("explains a missing backend without offering a pointless retry", async () => {
    state.fetch.mockResolvedValueOnce({ kind: "unavailable", reason: "not_configured" });
    render(<EbayResultsSection query="msi dgx spark" onTrack={() => {}} />);
    await debounce();
    expect(screen.getByText(/no reachable API server was configured/)).toBeTruthy();
    expect(screen.queryByLabelText("Retry eBay search")).toBeNull();
  });
  beforeEach(() => { vi.useFakeTimers(); state.fetch.mockReset(); state.fetch.mockResolvedValue(result); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("searches the entered keyword and tracks the selected offer without pasting", async () => {
    const track = vi.fn();
    render(<EbayResultsSection query="rtx5090" onTrack={track} />);
    await debounce();
    expect(state.fetch).toHaveBeenCalledWith("rtx5090");
    fireEvent.click(screen.getByLabelText("Track eBay listing RTX5090"));
    expect(track).toHaveBeenCalledWith(listing);
    expect(screen.getByText("Seller: seller")).toBeTruthy();
  });

  it("shows the converted amount for a listing priced in another currency", async () => {
    const thb = { ...listing, itemId: "thb-1", title: "CRS328", price: 3450, currency: "THB" };
    state.fetch.mockResolvedValueOnce({ kind: "results", source: "api", listings: [thb] });
    render(<EbayResultsSection query="crs328" onTrack={() => {}} />);
    await debounce();
    expect(screen.getByText("฿3,450.00")).toBeTruthy();
    expect(screen.getByText("≈ $100.00")).toBeTruthy();
  });

  it("shows an outage with Retry instead of claiming no matches", async () => {
    state.fetch.mockResolvedValueOnce({ kind: "unavailable", reason: "blocked" });
    render(<EbayResultsSection query="rtx5090" onTrack={() => {}} />);
    await debounce();
    expect(screen.queryByText("No eBay matches for this search.")).toBeNull();
    fireEvent.click(screen.getByLabelText("Retry eBay search"));
    await debounce();
    expect(state.fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByText("RTX5090")).toBeTruthy();
  });

  it("does not search pasted URLs", async () => {
    render(<EbayResultsSection query="https://www.ebay.com/itm/178212205608" onTrack={() => {}} />);
    await debounce();
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("ignores an old query that finishes after newer results", async () => {
    let resolveOld: (value: EbaySearchResult) => void = () => {};
    state.fetch.mockImplementationOnce(() => new Promise<EbaySearchResult>((resolve) => { resolveOld = resolve; }));
    const view = render(<EbayResultsSection query="router" onTrack={() => {}} />);
    await debounce();
    view.rerender(<EbayResultsSection query="rtx5090" onTrack={() => {}} />);
    await debounce();
    await act(async () => { resolveOld({ kind: "empty", source: "api" }); });
    expect(screen.getByText("RTX5090")).toBeTruthy();
    expect(screen.queryByText("No eBay matches for this search.")).toBeNull();
  });
});
