import type { AppSettings } from "./types";

/**
 * Settings that must never leave the device. The BYO-LLM API key is the only
 * one: it would otherwise be stored at rest on the server (settings sync) or
 * written into a user-shareable backup file. It is stripped from outbound
 * settings and ignored on inbound merges; the server only ever needs it
 * per-request, from the `x-llm-key` header.
 */
export function stripDeviceLocalSettings(settings: AppSettings): AppSettings {
  const copy = { ...settings };
  delete copy.llmApiKey;
  return copy;
}

/**
 * Secrets that must not travel in a user-shareable backup file. The webhook URL
 * is a bearer credential, but unlike the LLM key the server needs it for
 * delivery, so it is stripped only from backups — settings sync keeps it.
 */
export function stripBackupSecrets(settings: AppSettings): AppSettings {
  const copy = stripDeviceLocalSettings(settings);
  delete copy.alertWebhookUrl;
  return copy;
}

/** Keeps this device's own API key on an inbound merge (never adopt a remote one). */
export function applyLocalLlmKey(
  next: AppSettings,
  local: AppSettings,
): AppSettings {
  if (local.llmApiKey) next.llmApiKey = local.llmApiKey;
  else delete next.llmApiKey;
  return next;
}
