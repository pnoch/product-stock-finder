import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn().mockResolvedValue([]),
  getAlerts: vi.fn().mockResolvedValue([]),
  getSettings: vi.fn().mockResolvedValue({ displayCurrency: "USD" }),
  getBackOrderReminders: vi.fn().mockResolvedValue([]),
  getStockWatches: vi.fn().mockResolvedValue([]),
  getNotificationHistory: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  // Minimal stubs for other Alerts storage calls (extensible for later tasks)
  toggleAlert: vi.fn().mockResolvedValue(undefined),
  removeAlert: vi.fn().mockResolvedValue(undefined),
  rearmAlert: vi.fn().mockResolvedValue(undefined),
  snoozeAlert: vi.fn().mockResolvedValue(undefined),
  updateAlert: vi.fn().mockResolvedValue(undefined),
  addBackOrderReminder: vi.fn().mockResolvedValue(undefined),
  removeBackOrderReminder: vi.fn().mockResolvedValue(undefined),
  removeStockWatch: vi.fn().mockResolvedValue(undefined),
  // Watchlist bulk-tag sheet storage calls
  getTagDefinitions: vi.fn(),
  getSyncMeta: vi.fn(),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  // Search/discovery storage calls
  getDiscoveredProducts: vi.fn().mockResolvedValue([]),
  addToWatchlist: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/storage", () => ({ storage: mockStorage }));

const mockAuthState = vi.hoisted(() => ({
  user: null as null | {
    id: number;
    openId: string;
    name: string | null;
    email: string | null;
    loginMethod: string | null;
    lastSignedIn: string;
    emailVerified?: boolean | null;
  },
  resendVerification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/hooks/use-auth", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../src/hooks/use-auth")>();
  return {
    ...mod,
    useAuth: () => ({
      user: mockAuthState.user,
      isAuthenticated: Boolean(mockAuthState.user),
      login: vi.fn(),
      logout: vi.fn(),
    }),
    resendVerification: (...args: unknown[]) =>
      (mockAuthState.resendVerification as (...a: unknown[]) => Promise<void>)(...args),
  };
});

const mockDiscover = vi.hoisted(() => vi.fn());

vi.mock("../../lib/llm-discovery", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../lib/llm-discovery")>();
  return {
    ...mod,
    discoverProduct: mockDiscover,
  };
});

// jsdom cannot measure scroll containers, so the virtualized watchlist table
// renders zero rows. Render every row so selection checkboxes are clickable.
vi.mock("@tanstack/react-virtual", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@tanstack/react-virtual")>();
  return {
    ...mod,
    useVirtualizer: (opts: { count: number }) => ({
      getVirtualItems: () =>
        Array.from({ length: opts.count }, (_, index) => ({
          key: index,
          index,
          start: index * 76,
          end: index * 76 + 76,
          size: 76,
        })),
      getTotalSize: () => opts.count * 76,
      measureElement: () => {},
    }),
  };
});

vi.mock("../src/lib/trpc", () => ({
  trpc: {
    sharedWatchlists: {
      list: {
        useQuery: () => ({
          data: { links: [] },
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        }),
      },
      extend: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      revoke: { useMutation: () => ({ mutateAsync: vi.fn() }) },
    },
  },
  createTRPCClient: () => ({
    devices: {
      rename: { mutate: vi.fn() },
      signOut: { mutate: vi.fn() },
    },
    sharedWatchlists: { create: { mutate: vi.fn() } },
  }),
}));

import { Alerts } from "../src/pages/Alerts";
import { Watchlist } from "../src/pages/Watchlist";
import { RestockWatches } from "../src/pages/RestockWatches";
import { Search } from "../src/pages/Search";
import { SearchModal } from "../src/components/SearchModal";
import { Settings } from "../src/pages/Settings";
import { DiscoveryAuthError, DiscoveryError } from "../../lib/llm-discovery";

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getWatchlist.mockResolvedValue([]);
  mockStorage.getAlerts.mockResolvedValue([]);
  mockStorage.getSettings.mockResolvedValue({ displayCurrency: "USD" });
  mockStorage.getBackOrderReminders.mockResolvedValue([]);
  mockStorage.getStockWatches.mockResolvedValue([]);
  mockStorage.getNotificationHistory.mockRejectedValue(new Error("boom"));
  mockStorage.getUnreadNotificationCount.mockResolvedValue(0);
  mockStorage.getTagDefinitions.mockResolvedValue({});
  mockStorage.getSyncMeta.mockResolvedValue({ lastSyncedAt: 0, items: {} });
  mockStorage.getDiscoveredProducts.mockResolvedValue([]);
  mockStorage.addToWatchlist.mockResolvedValue(undefined);
});

describe("alerts error paths", () => {
  it("shows an inline error and offers Retry when notification history fails to load", async () => {
    render(<MemoryRouter><Alerts /></MemoryRouter>);
    // Notifications list lives under the notifications tab
    const tabButton = await screen.findByRole("button", { name: /show notifications/i });
    await userEvent.click(tabButton);
    await waitFor(() => expect(screen.getByText(/couldn't load notifications/i)).toBeInTheDocument());
    mockStorage.getNotificationHistory.mockResolvedValue([]);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(mockStorage.getNotificationHistory).toHaveBeenCalledTimes(2));
  });
});

describe("watchlist bulk-tag error path", () => {
  it("toasts when tag definitions fail to load", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockStorage.getWatchlist.mockResolvedValue([
      {
        id: "p1",
        name: "CRS326-24G-2S+RM",
        modelNumber: "CRS326-24G-2S+RM",
        brand: "MikroTik",
        category: "Switch",
        description: "",
        addedAt: new Date().toISOString(),
        isWatched: true,
        listings: [],
      },
    ]);
    mockStorage.getSettings.mockResolvedValue({ displayCurrency: "USD" });
    mockStorage.getTagDefinitions.mockRejectedValue(new Error("boom"));
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Watchlist />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await userEvent.click(await screen.findByLabelText("Enter bulk select mode"));
    await userEvent.click(await screen.findByLabelText("Select CRS326-24G-2S+RM"));
    await userEvent.click(screen.getByRole("button", { name: "Tag" }));
    await waitFor(() => expect(screen.getByText(/couldn't load tags/i)).toBeInTheDocument());
    queryClient.clear();
  });
});

describe("delete confirmations", () => {
  const alertFixture = {
    id: "a1",
    productId: "p1",
    targetPrice: 100,
    currency: "USD",
    isActive: true,
    createdAt: new Date().toISOString(),
    direction: "drop" as const,
    distributorId: null,
  };
  const reminderFixture = {
    id: "r1",
    productId: "p1",
    productName: "CRS326-24G-2S+RM",
    distributorId: "d1",
    distributorName: "TestDist",
    reminderDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  const watchFixture = {
    id: "w1",
    productId: "p1",
    productName: "CRS326-24G-2S+RM",
    distributorId: "d1",
    distributorName: "TestDist",
    reminderDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  function mockAlertsPageData() {
    mockStorage.getAlerts.mockResolvedValue([alertFixture]);
    mockStorage.getBackOrderReminders.mockResolvedValue([reminderFixture]);
    mockStorage.getStockWatches.mockResolvedValue([watchFixture]);
    mockStorage.getWatchlist.mockResolvedValue([]);
    mockStorage.getNotificationHistory.mockResolvedValue([]);
    mockStorage.getUnreadNotificationCount.mockResolvedValue(0);
  }

  it("does not delete an alert when the confirm is dismissed", async () => {
    mockAlertsPageData();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    try {
      render(<MemoryRouter><Alerts /></MemoryRouter>);
      await userEvent.click(await screen.findByRole("button", { name: /delete price alert/i }));
      await waitFor(() => expect(confirm).toHaveBeenCalled());
      expect(mockStorage.removeAlert).not.toHaveBeenCalled();
    } finally {
      confirm.mockRestore();
    }
  });

  it("deletes an alert when the confirm is accepted", async () => {
    mockAlertsPageData();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      render(<MemoryRouter><Alerts /></MemoryRouter>);
      await userEvent.click(await screen.findByRole("button", { name: /delete price alert/i }));
      await waitFor(() => expect(mockStorage.removeAlert).toHaveBeenCalledWith("a1"));
      expect(confirm).toHaveBeenCalledWith(expect.stringContaining("cannot be undone"));
    } finally {
      confirm.mockRestore();
    }
  });

  it("does not delete a reminder when the confirm is dismissed", async () => {
    mockAlertsPageData();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    try {
      render(<MemoryRouter><Alerts /></MemoryRouter>);
      await userEvent.click(await screen.findByRole("button", { name: /show reminders/i }));
      await userEvent.click(await screen.findByRole("button", { name: /^delete reminder$/i }));
      await waitFor(() => expect(confirm).toHaveBeenCalled());
      expect(mockStorage.removeBackOrderReminder).not.toHaveBeenCalled();
    } finally {
      confirm.mockRestore();
    }
  });

  it("deletes a reminder when the confirm is accepted", async () => {
    mockAlertsPageData();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      render(<MemoryRouter><Alerts /></MemoryRouter>);
      await userEvent.click(await screen.findByRole("button", { name: /show reminders/i }));
      await userEvent.click(await screen.findByRole("button", { name: /^delete reminder$/i }));
      await waitFor(() => expect(mockStorage.removeBackOrderReminder).toHaveBeenCalledWith("r1"));
      expect(confirm).toHaveBeenCalledWith(expect.stringContaining("cannot be undone"));
    } finally {
      confirm.mockRestore();
    }
  });

  it("does not delete a stock watch when the confirm is dismissed", async () => {
    mockAlertsPageData();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    try {
      render(<MemoryRouter><Alerts /></MemoryRouter>);
      await userEvent.click(await screen.findByRole("button", { name: /show reminders/i }));
      await userEvent.click(await screen.findByRole("button", { name: /delete stock watch/i }));
      await waitFor(() => expect(confirm).toHaveBeenCalled());
      expect(mockStorage.removeStockWatch).not.toHaveBeenCalled();
    } finally {
      confirm.mockRestore();
    }
  });

  it("does not remove a restock watch when the confirm is dismissed", async () => {
    mockStorage.getStockWatches.mockResolvedValue([watchFixture]);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    try {
      render(<MemoryRouter><RestockWatches /></MemoryRouter>);
      await userEvent.click(await screen.findByRole("button", { name: /remove CRS326-24G-2S\+RM from restock watches/i }));
      await waitFor(() => expect(confirm).toHaveBeenCalled());
      expect(mockStorage.removeStockWatch).not.toHaveBeenCalled();
    } finally {
      confirm.mockRestore();
    }
  });

  it("removes a restock watch when the confirm is accepted", async () => {
    mockStorage.getStockWatches.mockResolvedValue([watchFixture]);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      render(<MemoryRouter><RestockWatches /></MemoryRouter>);
      await userEvent.click(await screen.findByRole("button", { name: /remove CRS326-24G-2S\+RM from restock watches/i }));
      await waitFor(() => expect(mockStorage.removeStockWatch).toHaveBeenCalledWith("w1"));
      expect(confirm).toHaveBeenCalledWith(expect.stringContaining("cannot be undone"));
    } finally {
      confirm.mockRestore();
    }
  });
});

describe("discovery error paths", () => {
  const NO_MATCH_QUERY = "qqqxzy-nonexistent-12345";

  beforeEach(() => {
    mockDiscover.mockReset();
    mockDiscover.mockResolvedValue(null);
    mockStorage.getDiscoveredProducts.mockResolvedValue([]);
    mockStorage.addToWatchlist.mockResolvedValue(undefined);
  });

  it("Search shows sign-in guidance on DiscoveryAuthError with no Retry", async () => {
    mockDiscover.mockRejectedValue(new DiscoveryAuthError(401));
    render(<MemoryRouter><Search /></MemoryRouter>);
    const input = await screen.findByLabelText("Search products");
    await userEvent.type(input, NO_MATCH_QUERY);
    await userEvent.click(await screen.findByRole("button", { name: /discover with ai/i }));
    await waitFor(() => expect(screen.getByText(/please sign in to use ai discovery/i)).toBeInTheDocument());
    expect(screen.getAllByText("Sign-in Required").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("button", { name: /^retry$/i })).not.toBeInTheDocument();
  });

  it("Search offers Retry on timeout and retry re-invokes discovery", async () => {
    mockDiscover.mockRejectedValue(new DiscoveryError("timeout", "timed out"));
    render(<MemoryRouter><Search /></MemoryRouter>);
    const input = await screen.findByLabelText("Search products");
    await userEvent.type(input, NO_MATCH_QUERY);
    await userEvent.click(await screen.findByRole("button", { name: /discover with ai/i }));
    await waitFor(() => expect(screen.getByText(/discovery timed out/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /^retry$/i }));
    await waitFor(() => expect(mockDiscover).toHaveBeenCalledTimes(2));
  });

  it("SearchModal stays open and offers Retry on server error", async () => {
    const onClose = vi.fn();
    mockDiscover.mockRejectedValue(new DiscoveryError("server", "boom", { status: 500 }));
    render(<MemoryRouter><SearchModal open onClose={onClose} /></MemoryRouter>);
    const input = await screen.findByLabelText(/search products by name/i);
    // The modal focuses the input on a 50ms timer; typing before it fires can
    // lose characters. Wait for focus, then type.
    await waitFor(() => expect(document.activeElement).toBe(input));
    await userEvent.type(input, NO_MATCH_QUERY);
    await waitFor(() => expect(screen.getByText(/no products found/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /discover product with ai/i }));
    await waitFor(() => expect(screen.getByText(/server error \(500\)/i)).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /^retry$/i }));
    await waitFor(() => expect(mockDiscover).toHaveBeenCalledTimes(2));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("SearchModal shows sign-in guidance on DiscoveryAuthError without closing", async () => {
    const onClose = vi.fn();
    mockDiscover.mockRejectedValue(new DiscoveryAuthError(401));
    render(<MemoryRouter><SearchModal open onClose={onClose} /></MemoryRouter>);
    const input = await screen.findByLabelText(/search products by name/i);
    // The modal focuses the input on a 50ms timer; typing before it fires can
    // lose characters. Wait for focus, then type.
    await waitFor(() => expect(document.activeElement).toBe(input));
    await userEvent.type(input, NO_MATCH_QUERY);
    await waitFor(() => expect(screen.getByText(/no products found/i)).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /discover product with ai/i }));
    await waitFor(() => expect(screen.getByText(/please sign in to use ai discovery/i)).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^retry$/i })).not.toBeInTheDocument();
  });
});

describe("email verification in Settings", () => {
  const verifiedUserBase = {
    id: 1,
    openId: "email|1",
    name: "Test User",
    email: "test@example.com",
    loginMethod: "email",
    lastSignedIn: new Date().toISOString(),
  };

  function renderSettings() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    return queryClient;
  }

  beforeEach(() => {
    mockAuthState.user = null;
    mockAuthState.resendVerification.mockReset();
    mockAuthState.resendVerification.mockResolvedValue(undefined);
  });

  it("shows a Resend affordance for an unverified email and toasts on success", async () => {
    mockAuthState.user = { ...verifiedUserBase, emailVerified: false };
    const queryClient = renderSettings();
    try {
      const resend = await screen.findByRole("button", { name: /resend verification email/i });
      expect(resend).toBeInTheDocument();
      await userEvent.click(resend);
      await waitFor(() => expect(mockAuthState.resendVerification).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByText(/verification email sent/i)).toBeInTheDocument());
    } finally {
      queryClient.clear();
    }
  });

  it("shows a Verified badge and no Resend button when the email is verified", async () => {
    mockAuthState.user = { ...verifiedUserBase, emailVerified: true };
    const queryClient = renderSettings();
    try {
      await waitFor(() => expect(screen.getByLabelText("Email verified")).toBeInTheDocument());
      expect(screen.queryByRole("button", { name: /resend verification email/i })).not.toBeInTheDocument();
      expect(mockAuthState.resendVerification).not.toHaveBeenCalled();
    } finally {
      queryClient.clear();
    }
  });
});
