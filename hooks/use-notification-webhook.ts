import { useState } from "react";
import type { AppSettings } from "@/lib/types";

export function useNotificationWebhook({
  settings,
  updateSetting,
}: {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
  const [webhookUrl, setWebhookUrl] = useState(settings.alertWebhookUrl ?? "");
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookHint, setWebhookHint] = useState<string | null>(null);
  const [webhookHintOk, setWebhookHintOk] = useState(false);

  const commitWebhookUrl = () => {
    const next = webhookUrl.trim();
    if (next !== (settings.alertWebhookUrl ?? "")) {
      updateSetting("alertWebhookUrl", next);
    }
  };

  const handleTestWebhook = async () => {
    const url = webhookUrl.trim();
    if (!url) {
      setWebhookHintOk(false);
      setWebhookHint("Enter a webhook URL first.");
      return;
    }
    setTestingWebhook(true);
    setWebhookHint(null);
    try {
      const { testWebhook } = await import("@/lib/server-notifications");
      const result = await testWebhook(url);
      setWebhookHintOk(result.ok);
      setWebhookHint(result.ok ? "Test message sent." : (result.error ?? "Test failed."));
    } catch {
      setWebhookHintOk(false);
      setWebhookHint("Test failed.");
    } finally {
      setTestingWebhook(false);
    }
  };

  return {
    webhookUrl,
    setWebhookUrl,
    testingWebhook,
    webhookHint,
    webhookHintOk,
    commitWebhookUrl,
    handleTestWebhook,
  };
}
