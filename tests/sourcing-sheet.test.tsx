// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    View: ({ children, ...r }: any) => React.createElement("div", r, children),
    Text: ({ children, ...r }: any) => React.createElement("span", r, children),
    TextInput: ({ onChangeText, ...r }: any) =>
      React.createElement("input", { ...r, onChange: (e: any) => onChangeText?.(e.target.value) }),
    Pressable: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress }, children),
    TouchableOpacity: ({ children, onPress, accessibilityLabel, ...r }: any) =>
      React.createElement("button", { ...r, "aria-label": accessibilityLabel, onClick: onPress }, children),
    Modal: ({ children, visible }: any) => (visible ? React.createElement("div", null, children) : null),
    Platform: { OS: "ios" },
  };
});
vi.mock("@/hooks/use-colors", () => ({
  useColors: () => ({ foreground: "#111", muted: "#888", primary: "#0F52BA", success: "#0a0", border: "#ddd", surface: "#fff", warning: "#fa0", error: "#f00" }),
}));
vi.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));
vi.mock("expo-haptics", () => ({ impactAsync: vi.fn(), notificationAsync: vi.fn(), ImpactFeedbackStyle: { Medium: "medium" }, NotificationFeedbackType: { Success: "success" } }));
vi.mock("@/lib/alert", () => ({ showAlert: vi.fn() }));
const updateProductSourcing = vi.fn(async (_id: string, _fields: unknown) => {});
vi.mock("@/lib/storage", () => ({
  updateProductSourcing: (id: string, fields: unknown) => updateProductSourcing(id, fields),
}));

import { SourcingSheet } from "../components/sourcing/sourcing-sheet";

afterEach(() => {
  cleanup();
  updateProductSourcing.mockClear();
});

const base = {
  visible: true,
  productId: "p1",
  productName: "P1",
  currency: "USD",
  onClose: () => {},
};

describe("SourcingSheet", () => {
  it("saves the parsed quantity and sell price", async () => {
    const onSaved = vi.fn();
    render(<SourcingSheet {...base} quantity={20} targetSellPrice={280} onSaved={onSaved} />);
    fireEvent.click(screen.getByText(/save/i));
    await waitFor(() =>
      expect(updateProductSourcing).toHaveBeenCalledWith("p1", {
        quantity: 20,
        targetSellPrice: 280,
        sellCurrency: "USD",
      }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("clears the fields", async () => {
    render(<SourcingSheet {...base} quantity={20} targetSellPrice={280} onSaved={() => {}} />);
    fireEvent.click(screen.getByText(/clear/i));
    await waitFor(() =>
      expect(updateProductSourcing).toHaveBeenCalledWith("p1", {
        quantity: null,
        targetSellPrice: null,
      }),
    );
  });

  it("treats a non-positive quantity as null", async () => {
    render(<SourcingSheet {...base} quantity={20} targetSellPrice={280} onSaved={() => {}} />);
    const qtyInput = screen.getAllByRole("textbox")[0]!;
    fireEvent.change(qtyInput, { target: { value: "-5" } });
    fireEvent.click(screen.getByText(/save/i));
    await waitFor(() =>
      expect(updateProductSourcing).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ quantity: null }),
      ),
    );
  });
});
