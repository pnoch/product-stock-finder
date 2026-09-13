// desktop/tests/settings-push.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Settings } from "../src/pages/Settings";
import {
  isPushSupported,
  ensurePushSubscription,
  disablePush,
  getPushStatus,
  hasVapidKey,
} from "../src/lib/web-push";

const mockStorage = vi.hoisted(() => ({
  getWatchlist: vi.fn().mockResolvedValue([]),
  getAlerts: vi.fn().mockResolvedValue([]),
  getSettings: vi.fn().mockResolvedValue({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
  }),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  getBackOrderReminders: vi.fn().mockResolvedValue([]),
  getStockWatches: vi.fn().mockResolvedValue([]),
  getSyncMeta: vi.fn().mockResolvedValue({ lastSyncedAt: 0, items: {} }),
}));

vi.mock("../src/storage", () => ({
  storage: mockStorage,
}));

const mockAuthState = vi.hoisted(() => ({
  user: {
    id: 1,
    openId: "o1",
    name: "Test",
    email: "t@example.com",
    loginMethod: "email",
    lastSignedIn: new Date().toISOString(),
  } as unknown,
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
  };
});

vi.mock("../src/hooks/use-connection", () => ({
  useConnection: () => ({
    status: "local" as const,
    reachable: false,
    isRefreshing: false,
    lastCheckedAt: null,
    refetch: () => {},
  }),
}));

vi.mock("../src/lib/web-push", () => ({
  isPushSupported: vi.fn().mockReturnValue(true),
  ensurePushSubscription: vi.fn(),
  disablePush: vi.fn(),
  getPushStatus: vi.fn(),
  hasVapidKey: vi.fn().mockReturnValue(true),
}));

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

function renderSettingsWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/settings"]}>
        <Settings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.getSettings.mockResolvedValue({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
  });
  mockAuthState.user = {
    id: 1,
    openId: "o1",
    name: "Test",
    email: "t@example.com",
    loginMethod: "email",
    lastSignedIn: new Date().toISOString(),
  } as unknown;
  vi.mocked(isPushSupported).mockReturnValue(true);
  vi.mocked(hasVapidKey).mockReturnValue(true);
  vi.mocked(getPushStatus).mockResolvedValue("off");
  vi.mocked(ensurePushSubscription).mockResolvedValue(true);
  vi.mocked(disablePush).mockResolvedValue(undefined);
  Object.defineProperty(window, "isSecureContext", {
    writable: true,
    configurable: true,
    value: true,
  });
  Object.defineProperty(window, "Notification", {
    writable: true,
    configurable: true,
    value: Object.assign(function () {}, {
      permission: "default",
      requestPermission: vi.fn().mockResolvedValue("granted"),
    }),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Settings push opt-in", () => {
  it("enables push with permission + toast", async () => {
    const queryClient = renderSettingsWithProviders();
    try {
      const enableBtn = await screen.findByRole("button", {
        name: "Enable push notifications",
      });
      fireEvent.click(enableBtn);
      await waitFor(() => {
        expect(ensurePushSubscription).toHaveBeenCalledTimes(1);
      });
      expect(await screen.findByText("Push notifications enabled")).toBeInTheDocument();
      expect(
        await screen.findByRole("button", { name: "Disable push notifications" }),
      ).toBeInTheDocument();
    } finally {
      queryClient.clear();
    }
  });

  it("stays disabled with reason when signed out", async () => {
    mockAuthState.user = null;
    const queryClient = renderSettingsWithProviders();
    try {
      const enableBtn = await screen.findByRole("button", {
        name: "Enable push notifications",
      });
      expect(enableBtn).toBeDisabled();
      expect(screen.getByText("Sign in to enable push")).toBeInTheDocument();
      fireEvent.click(enableBtn);
      expect(ensurePushSubscription).not.toHaveBeenCalled();
    } finally {
      queryClient.clear();
    }
  });

  it("surfaces subscribe failure", async () => {
    vi.mocked(ensurePushSubscription).mockResolvedValue(false);
    const queryClient = renderSettingsWithProviders();
    try {
      const enableBtn = await screen.findByRole("button", {
        name: "Enable push notifications",
      });
      fireEvent.click(enableBtn);
      expect(await screen.findByText("Couldn't enable push notifications")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Disable push notifications" }),
      ).not.toBeInTheDocument();
    } finally {
      queryClient.clear();
    }
  });

  it("surfaces permission denial without subscribing", async () => {
    vi.mocked(
      (window.Notification as unknown as { requestPermission: () => Promise<string> })
        .requestPermission,
    ).mockResolvedValue("denied");
    const queryClient = renderSettingsWithProviders();
    try {
      const enableBtn = await screen.findByRole("button", {
        name: "Enable push notifications",
      });
      fireEvent.click(enableBtn);
      expect(
        await screen.findByText("Notification permission not granted"),
      ).toBeInTheDocument();
      expect(ensurePushSubscription).not.toHaveBeenCalled();
    } finally {
      queryClient.clear();
    }
  });

  it("disables push with toast", async () => {
    vi.mocked(getPushStatus).mockResolvedValue("on");
    const queryClient = renderSettingsWithProviders();
    try {
      const disableBtn = await screen.findByRole("button", {
        name: "Disable push notifications",
      });
      fireEvent.click(disableBtn);
      await waitFor(() => {
        expect(disablePush).toHaveBeenCalledTimes(1);
      });
      expect(
        await screen.findByText("Push notifications disabled"),
      ).toBeInTheDocument();
    } finally {
      queryClient.clear();
    }
  });

  it("shows browser-unsupported reason", async () => {
    vi.mocked(isPushSupported).mockReturnValue(false);
    const queryClient = renderSettingsWithProviders();
    try {
      expect(
        await screen.findByText("Push isn't available in this browser"),
      ).toBeInTheDocument();
      expect(ensurePushSubscription).not.toHaveBeenCalled();
    } finally {
      queryClient.clear();
    }
  });

  it("shows server-unconfigured reason without a VAPID key", async () => {
    vi.mocked(hasVapidKey).mockReturnValue(false);
    const queryClient = renderSettingsWithProviders();
    try {
      expect(
        await screen.findByText("Push isn't configured on this server"),
      ).toBeInTheDocument();
    } finally {
      queryClient.clear();
    }
  });

  it("guards re-entrancy while a subscribe is in flight", async () => {
    let release!: (v: boolean) => void;
    const pending = new Promise<boolean>((resolve) => {
      release = resolve;
    });
    vi.mocked(ensurePushSubscription).mockReturnValue(pending);
    const queryClient = renderSettingsWithProviders();
    try {
      const enableBtn = await screen.findByRole("button", {
        name: "Enable push notifications",
      });
      fireEvent.click(enableBtn);
      fireEvent.click(enableBtn);
      await waitFor(() => {
        expect(ensurePushSubscription).toHaveBeenCalledTimes(1);
      });
      release(true);
      expect(await screen.findByText("Push notifications enabled")).toBeInTheDocument();
    } finally {
      queryClient.clear();
    }
  });
});
