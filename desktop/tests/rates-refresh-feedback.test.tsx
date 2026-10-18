import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), maybeRefresh: vi.fn(), history: vi.fn() }));
vi.mock("../../lib/fx", () => ({ refreshFxRates: mocks.refresh, maybeRefreshFxRates: mocks.maybeRefresh }));
vi.mock("../src/storage", () => ({ storage: { getFxHistory: mocks.history } }));
vi.mock("../src/hooks/use-theme", () => ({ useTheme: () => ({ isDark: false }) }));
import { Rates } from "../src/pages/Rates";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.maybeRefresh.mockResolvedValue(undefined);
  mocks.refresh.mockResolvedValue(false);
  mocks.history.mockResolvedValue({ rates: { EUR: [0.88] }, timestamps: [Date.now() - 86400000] });
});
afterEach(cleanup);

it("keeps cached rates on failed refresh, reports it, and clears the error on retry", async () => {
  render(<Rates />);
  await screen.findByText("0.8800");
  fireEvent.click(screen.getByRole("button", { name: "Refresh rates" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't refresh exchange rates");
  expect(screen.getByText("0.8800")).toBeInTheDocument();

  mocks.refresh.mockResolvedValue(true);
  mocks.history.mockResolvedValue({ rates: { EUR: [0.9] }, timestamps: [Date.now()] });
  fireEvent.click(screen.getByRole("button", { name: "Refresh rates" }));
  await screen.findByText("0.9000");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("does not let a late background history read erase a manual refresh failure", async () => {
  let finishBackground = () => {};
  mocks.maybeRefresh.mockReturnValue(new Promise<void>((resolve) => { finishBackground = resolve; }));
  render(<Rates />);
  await screen.findByText("0.8800");
  fireEvent.click(screen.getByRole("button", { name: "Refresh rates" }));
  await screen.findByRole("alert");
  await act(async () => { finishBackground(); });
  expect(screen.getByRole("alert")).toHaveTextContent("Couldn't refresh exchange rates");
});
