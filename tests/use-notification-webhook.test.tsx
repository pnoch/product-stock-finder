// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "../lib/types";

const state = vi.hoisted(() => ({
  result: { ok: true } as { ok: boolean; error?: string },
  reject: false,
}));

vi.mock("../lib/server-notifications", () => ({
  testWebhook: vi.fn(async () => {
    if (state.reject) throw new Error("network");
    return state.result;
  }),
}));

import { useNotificationWebhook } from "../hooks/use-notification-webhook";

const settings = {
  alertWebhookUrl: "https://example.com/hook",
} as AppSettings;

describe("useNotificationWebhook", () => {
  beforeEach(() => {
    state.result = { ok: true };
    state.reject = false;
  });

  function setup(updateSetting = vi.fn()) {
    const hook = renderHook(() =>
      useNotificationWebhook({ settings, updateSetting }),
    );
    return { ...hook, updateSetting };
  }

  it("initializes from settings", () => {
    const { result } = setup();
    expect(result.current.webhookUrl).toBe("https://example.com/hook");
  });

  it("commits only when the URL changed", () => {
    const { result, updateSetting } = setup();
    act(() => result.current.commitWebhookUrl());
    expect(updateSetting).not.toHaveBeenCalled();

    act(() => result.current.setWebhookUrl("https://example.com/new"));
    act(() => result.current.commitWebhookUrl());
    expect(updateSetting).toHaveBeenCalledWith(
      "alertWebhookUrl",
      "https://example.com/new",
    );
  });

  it("asks for a URL before testing", async () => {
    const { result } = setup();
    act(() => result.current.setWebhookUrl("  "));
    await act(async () => {
      await result.current.handleTestWebhook();
    });
    expect(result.current.webhookHint).toBe("Enter a webhook URL first.");
    expect(result.current.webhookHintOk).toBe(false);
  });

  it("reports a successful test", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.handleTestWebhook();
    });
    expect(result.current.webhookHint).toBe("Test message sent.");
    expect(result.current.webhookHintOk).toBe(true);
    expect(result.current.testingWebhook).toBe(false);
  });

  it("reports a failed test with the server error", async () => {
    state.result = { ok: false, error: "HTTP 404" };
    const { result } = setup();
    await act(async () => {
      await result.current.handleTestWebhook();
    });
    expect(result.current.webhookHint).toBe("HTTP 404");
    expect(result.current.webhookHintOk).toBe(false);
  });

  it("reports a thrown test failure", async () => {
    state.reject = true;
    const { result } = setup();
    await act(async () => {
      await result.current.handleTestWebhook();
    });
    expect(result.current.webhookHint).toBe("Test failed.");
    expect(result.current.webhookHintOk).toBe(false);
  });
});
