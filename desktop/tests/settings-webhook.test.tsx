// desktop/tests/settings-webhook.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Settings } from "../src/pages/Settings";
import { isPushSupported, hasVapidKey, getPushStatus } from "../src/lib/web-push";

const webhookMutate = vi.hoisted(() => vi.fn());

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
    webhookAlerts: true,
    alertWebhookUrl: "https://discord.com/api/webhooks/1/x",
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
      setMembersOnly: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      inviteByEmail: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      removeMember: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      join: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      leave: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      members: {
        useQuery: () => ({ data: { members: [] }, isLoading: false, refetch: vi.fn() }),
      },
      listJoined: {
        useQuery: () => ({ data: { shares: [] }, isLoading: false, refetch: vi.fn() }),
      },
    },
  },
  createTRPCClient: () => ({
    notifications: { testWebhook: { mutate: webhookMutate } },
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
  webhookMutate.mockReset();
  mockStorage.getSettings.mockResolvedValue({
    theme: "auto",
    displayCurrency: "USD",
    checkInterval: "manual",
    notificationsEnabled: true,
    stockAlerts: true,
    priceAlerts: true,
    webhookAlerts: true,
    alertWebhookUrl: "https://discord.com/api/webhooks/1/x",
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

describe("Settings webhook alerts", () => {
  it("sends a test to the entered URL when signed in", async () => {
    webhookMutate.mockResolvedValue({ ok: true });
    const queryClient = renderSettingsWithProviders();
    try {
      const urlInput = await screen.findByLabelText("Webhook URL");
      // The input is seeded from the async settings load; typing before that
      // resolves lets the seed effect overwrite the new value (flaky).
      await waitFor(() =>
        expect(urlInput).toHaveValue("https://discord.com/api/webhooks/1/x"),
      );
      const newUrl = "https://discord.com/api/webhooks/2/y";
      fireEvent.change(urlInput, { target: { value: newUrl } });

      const sendBtn = await screen.findByRole("button", { name: "Send test" });
      expect(sendBtn).toBeEnabled();
      fireEvent.click(sendBtn);

      await waitFor(() => {
        expect(webhookMutate).toHaveBeenCalledWith({ url: newUrl });
      });
      expect(await screen.findByText("Test message sent.")).toBeInTheDocument();
    } finally {
      queryClient.clear();
    }
  });

  it("disables the control and shows a note when signed out", async () => {
    mockAuthState.user = null;
    const queryClient = renderSettingsWithProviders();
    try {
      const sendBtn = await screen.findByRole("button", { name: "Send test" });
      expect(sendBtn).toBeDisabled();
      expect(screen.getByText("Sign in to use webhook alerts.")).toBeInTheDocument();
      fireEvent.click(sendBtn);
      expect(webhookMutate).not.toHaveBeenCalled();
    } finally {
      queryClient.clear();
    }
  });
});
