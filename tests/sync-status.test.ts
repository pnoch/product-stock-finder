import { describe, expect, it } from "vitest";
import {
  formatSyncStatus,
  getSyncSetup,
  registerSyncSetup,
} from "../lib/sync";
import type { SyncSetup } from "../lib/sync";
import type { SyncMeta } from "../lib/types";

function makeMeta(overrides: Partial<SyncMeta> = {}): SyncMeta {
  return { lastSyncedAt: 0, items: {}, ...overrides };
}

describe("formatSyncStatus", () => {
  it("prompts sign-in when signed out", () => {
    expect(formatSyncStatus(makeMeta(), false, Date.now())).toEqual({
      label: "Sign in to sync across devices",
      tone: "muted",
    });
  });

  it("prompts sign-in even when a prior error exists", () => {
    expect(
      formatSyncStatus(
        makeMeta({ lastSyncError: "Pull failed: x" }),
        false,
        Date.now(),
      ),
    ).toEqual({ label: "Sign in to sync across devices", tone: "muted" });
  });

  it("reports a failed sync in error tone", () => {
    const status = formatSyncStatus(
      makeMeta({ lastSyncError: "Pull failed: network down" }),
      true,
      Date.now(),
    );
    expect(status.tone).toBe("error");
    expect(status.label).toBe("Pull failed: network down");
  });

  it("reports not synced yet when signed in with no success timestamp", () => {
    expect(formatSyncStatus(makeMeta(), true, Date.now())).toEqual({
      label: "Not synced yet",
      tone: "muted",
    });
  });

  it("shows a recent sync in success tone", () => {
    const now = 1_000_000;
    const status = formatSyncStatus(
      makeMeta({ lastSyncedAt: now - 10_000 }),
      true,
      now,
    );
    expect(status.label).toBe("Synced just now");
    expect(status.tone).toBe("success");
  });

  it("uses lastSyncOkAt as the success timestamp when present", () => {
    const now = 1_000_000;
    const status = formatSyncStatus(
      makeMeta({ lastSyncedAt: now - 10_000_000, lastSyncOkAt: now - 600_000 }),
      true,
      now,
    );
    expect(status.label).toBe("Last synced 10m ago");
  });

  it("falls back to muted tone for stale syncs", () => {
    const now = 1_000_000;
    const status = formatSyncStatus(
      makeMeta({ lastSyncedAt: now - 600_000 }),
      true,
      now,
    );
    expect(status.label).toBe("Last synced 10m ago");
    expect(status.tone).toBe("muted");
  });
});

describe("registerSyncSetup", () => {
  it("clears the registered setup when the cleanup is invoked", () => {
    const setup = {} as SyncSetup;
    const unregister = registerSyncSetup(setup);
    expect(getSyncSetup()).toBe(setup);
    unregister();
    expect(getSyncSetup()).toBeNull();
  });

  it("does not clear a newer registration", () => {
    const first = {} as SyncSetup;
    const second = {} as SyncSetup;
    const unregisterFirst = registerSyncSetup(first);
    registerSyncSetup(second);
    unregisterFirst();
    expect(getSyncSetup()).toBe(second);
  });
});
