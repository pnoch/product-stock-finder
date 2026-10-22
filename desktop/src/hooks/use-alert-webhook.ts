import { useCallback, useState } from "react";
import type { AppSettings } from "../../../lib/types";
import { createTRPCClient } from "../lib/trpc";

export function useAlertWebhook({
  settings,
  update,
}: {
  settings: AppSettings;
  update: (partial: Partial<AppSettings>) => Promise<void> | void;
}) {
  const [webhookUrl, setWebhookUrl] = useState(settings.alertWebhookUrl ?? "");
  const [webhookHint, setWebhookHint] = useState<string | null>(null);
  const [webhookHintOk, setWebhookHintOk] = useState(false);
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [prevWebhookUrl, setPrevWebhookUrl] = useState(settings.alertWebhookUrl);

  if (settings.alertWebhookUrl !== prevWebhookUrl) {
    setPrevWebhookUrl(settings.alertWebhookUrl);
    setWebhookUrl(settings.alertWebhookUrl ?? "");
  }

  const handleTestWebhook = useCallback(async () => {
    const url = webhookUrl.trim();
    if (!url) {
      setWebhookHintOk(false);
      setWebhookHint("Enter a webhook URL first.");
      return;
    }
    setWebhookHint(null);
    setWebhookTesting(true);
    try {
      const client = createTRPCClient();
      const result = await client.notifications.testWebhook.mutate({ url });
      setWebhookHintOk(result.ok);
      setWebhookHint(
        result.ok ? "Test message sent." : (result.error ?? "Test failed."),
      );
    } catch {
      setWebhookHintOk(false);
      setWebhookHint("Test failed.");
    } finally {
      setWebhookTesting(false);
    }
  }, [webhookUrl]);

  const saveWebhookUrl = useCallback(() => {
    const next = webhookUrl.trim();
    if (next !== (settings.alertWebhookUrl ?? "")) {
      void update({ alertWebhookUrl: next });
    }
  }, [webhookUrl, settings.alertWebhookUrl, update]);

  return {
    webhookUrl,
    setWebhookUrl,
    webhookHint,
    webhookHintOk,
    webhookTesting,
    handleTestWebhook,
    saveWebhookUrl,
  };
}
