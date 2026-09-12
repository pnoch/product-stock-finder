// desktop/tests/settings-webtoggle.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Settings } from "../src/pages/Settings";
import { sendDesktopNotification } from "../src/notifications";
import { invoke } from "@tauri-apps/api/core";
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
    webNotificationsEnabled: false,
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

vi.mock("@tauri-apps/api/core", async (importOriginal) => {
  const mod =
    await importOriginal<typeof import("@tauri-apps/api/core")>();
  return {
    ...mod,
    invoke: vi.fn(),
  };
});

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
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
    webNotificationsEnabled: false,
  });
  vi.mocked(invoke).mockResolvedValue(undefined);
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
    value: Object.assign(vi.fn(), {
      permission: "default",
      requestPermission: vi.fn().mockResolvedValue("granted"),
    }),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Settings web notifications toggle", () => {
  it("toggles web notifications with permission flow", async () => {
    const user = userEvent.setup();
    const queryClient = renderSettingsWithProviders();
    try {
      const toggle = await screen.findByRole("checkbox", {
        name: "Enable web notifications",
      });
      expect(toggle).not.toBeChecked();
      await user.click(toggle);
      await waitFor(() => {
        expect(mockStorage.saveSettings).toHaveBeenCalledWith(
          expect.objectContaining({ webNotificationsEnabled: true }),
        );
      });
      expect(
        screen.queryByText(
          "Notifications are blocked in your browser settings.",
        ),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(
          "Allow notifications in your browser to receive alerts.",
        ),
      ).not.toBeInTheDocument();
      expect(
        await screen.findByRole("checkbox", {
          name: "Enable web notifications",
        }),
      ).toBeChecked();
    } finally {
      queryClient.clear();
    }
  });

  it("shows the blocked hint when denied", async () => {
    vi.mocked(
      (
        window.Notification as unknown as {
          requestPermission: () => Promise<string>;
        }
      ).requestPermission,
    ).mockResolvedValue("denied");
    const user = userEvent.setup();
    const queryClient = renderSettingsWithProviders();
    try {
      const toggle = await screen.findByRole("checkbox", {
        name: "Enable web notifications",
      });
      await user.click(toggle);
      expect(
        await screen.findByText(
          "Notifications are blocked in your browser settings.",
        ),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(mockStorage.saveSettings).toHaveBeenCalledWith(
          expect.objectContaining({ webNotificationsEnabled: false }),
        );
      });
    } finally {
      queryClient.clear();
    }
  });

  it("falls back to web display when Tauri is absent and setting is on", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("no tauri"));
    mockStorage.getSettings.mockResolvedValue({
      theme: "auto",
      displayCurrency: "USD",
      checkInterval: "manual",
      notificationsEnabled: true,
      stockAlerts: true,
      priceAlerts: true,
      webNotificationsEnabled: true,
    });
    const notifyCtor = vi.fn();
    Object.defineProperty(window, "Notification", {
      writable: true,
      configurable: true,
      value: Object.assign(notifyCtor, {
        permission: "granted",
        requestPermission: vi.fn().mockResolvedValue("granted"),
      }),
    });
    await sendDesktopNotification("Price drop!", "CRS804 is $89");
    expect(notifyCtor).toHaveBeenCalledTimes(1);
    expect(notifyCtor).toHaveBeenCalledWith("Price drop!", {
      body: "CRS804 is $89",
    });
  });
});
