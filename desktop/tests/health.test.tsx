import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Health } from "../src/pages/Health";

const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe("Health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([
      {
        distributorId: "server2u-my",
        status: "working",
        reason: null,
        responseTimeMs: 120,
        lastChecked: new Date().toISOString(),
      },
      {
        distributorId: "nasstore-eu",
        status: "error",
        reason: "Fetch failed",
        responseTimeMs: 300,
        lastChecked: new Date().toISOString(),
      },
    ]);
  });

  it("renders the title", async () => {
    render(
      <MemoryRouter>
        <Health />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Distributor Health")).toBeDefined();
  });

  it("calls invoke on mount", async () => {
    render(
      <MemoryRouter>
        <Health />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("check_distributor_health");
    });
  });

  it("renders distributor names from invoke result", async () => {
    render(
      <MemoryRouter>
        <Health />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Server2U/)).toBeDefined();
    expect(await screen.findByText(/NAS Store EU/)).toBeDefined();
  });

  it("renders Test All button", async () => {
    render(
      <MemoryRouter>
        <Health />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Test All Distributors")).toBeDefined();
  });
});
