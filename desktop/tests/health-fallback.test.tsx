import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const mockHealthQuery = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/trpc", () => ({
  createTRPCClient: () => ({ health: { check: { query: mockHealthQuery } } }),
}));

import { Health } from "../src/pages/Health";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

function renderHealth() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Health />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return qc;
}

describe("health web fallback", () => {
  it("falls back to the server endpoint when Tauri invoke fails", async () => {
    mockInvoke.mockRejectedValue(new Error("no tauri"));
    mockHealthQuery.mockResolvedValue([
      {
        distributorId: "server2u-my",
        status: "working",
        responseTimeMs: 100,
        lastChecked: new Date().toISOString(),
      },
    ]);
    const qc = renderHealth();
    try {
      await userEvent.click(screen.getByRole("button", { name: /test all/i }));
      await waitFor(() => expect(mockHealthQuery).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByText(/Server2U/)).toBeInTheDocument());
      expect(screen.queryByText("no tauri")).not.toBeInTheDocument();
    } finally {
      qc.clear();
    }
  });

  it("still uses Tauri when invoke succeeds", async () => {
    mockInvoke.mockResolvedValue([
      {
        distributorId: "server2u-my",
        status: "working",
        responseTimeMs: 100,
        lastChecked: new Date().toISOString(),
      },
    ]);
    const qc = renderHealth();
    try {
      await userEvent.click(screen.getByRole("button", { name: /test all/i }));
      await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("check_distributor_health"));
      expect(mockHealthQuery).not.toHaveBeenCalled();
    } finally {
      qc.clear();
    }
  });
});
