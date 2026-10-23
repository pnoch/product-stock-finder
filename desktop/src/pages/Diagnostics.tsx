import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, XCircle, HelpCircle, RefreshCw } from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { createTRPCClient } from "../lib/trpc";
import { getDesktopDeviceId } from "../lib/device-id";
import { pushErrorHelpText, type PushStatusDevice } from "../../../lib/server-notifications";
import { formatLastRefreshed } from "../../../lib/last-refreshed";

function StatusIcon({ device }: { device: PushStatusDevice }) {
  if (!device.outcome) {
    return <HelpCircle className="w-7 h-7 text-gray-400 dark:text-gray-500" aria-label="No pushes sent yet" />;
  }
  if (device.outcome.status === "ok") {
    return <CheckCircle2 className="w-7 h-7 text-emerald-500" aria-label="Delivered" />;
  }
  return <XCircle className="w-7 h-7 text-red-500" aria-label="Failed" />;
}

function DeviceCard({
  device,
  isMine,
  testing,
  onTest,
}: {
  device: PushStatusDevice;
  isMine: boolean;
  testing: boolean;
  onTest: (deviceId: string) => void;
}) {
  const outcome = device.outcome;
  const name = device.label ?? `${device.deviceId.slice(0, 12)}…`;
  const statusText = !outcome
    ? "No pushes sent yet"
    : outcome.status === "ok"
      ? `Delivered · ${formatLastRefreshed(new Date(outcome.sentAt).toISOString())}`
      : `Failed: ${outcome.error} · ${formatLastRefreshed(new Date(outcome.sentAt).toISOString())}`;

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2.5">
        <StatusIcon device={device} />
        <p className="text-base font-semibold flex-1 truncate">{name}</p>
        {isMine && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
            This device
          </span>
        )}
        <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-[11px] font-semibold">
          {device.platform ?? "unknown"}
        </span>
      </div>

      <p className="text-sm mt-2.5">{statusText}</p>
      {outcome?.error && (
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1 leading-5">
          {pushErrorHelpText(outcome.error)}
        </p>
      )}

      <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-2">
        Push token: {device.hasToken ? "Yes" : "No"}
      </p>
      {outcome && (
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
          Last batch: {outcome.eventCount} event(s)
        </p>
      )}
      {outcome?.ticketId && (
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5 font-mono truncate">
          Ticket: {outcome.ticketId.slice(0, 16)}…
        </p>
      )}

      <button
        type="button"
        disabled={testing}
        onClick={() => onTest(device.deviceId)}
        aria-label={`Send test push to ${name}`}
        className="mt-3 w-full py-2.5 rounded-[10px] border border-brand-600 text-brand-600 dark:text-brand-400 text-sm font-semibold hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-60 transition-colors"
      >
        {testing ? "Sending…" : "Send test push"}
      </button>
    </div>
  );
}

export function Diagnostics() {
  const { toast, showToast } = useToast();
  const [devices, setDevices] = useState<PushStatusDevice[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoadError(null);
      const client = createTRPCClient();
      const [res, mine] = await Promise.all([
        client.notifications.pushStatusAll.query({}),
        getDesktopDeviceId().catch(() => null),
      ]);
      setDevices(res.devices as PushStatusDevice[]);
      setMyDeviceId(mine);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load diagnostics");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const onTest = useCallback(
    async (deviceId: string) => {
      setTestingId(deviceId);
      try {
        const client = createTRPCClient();
        const outcome = await client.notifications.sendTestPush.mutate({});
        await load();
        if (outcome?.status === "ok") {
          showToast("Test push delivered");
        } else if (outcome == null) {
          showToast("Test push sent — check your device");
        } else {
          showToast(`Test push failed: ${pushErrorHelpText(outcome?.error ?? "unknown")}`);
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Test push failed");
      } finally {
        setTestingId(null);
      }
    },
    [load, showToast],
  );

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold flex-1">Push Diagnostics</h1>
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={refreshing}
          aria-label="Refresh diagnostics"
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-brand-600 dark:text-brand-400 disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>
      {toast && (
        <div role="status" className="fixed bottom-6 right-6 bg-gray-900 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-[60]">
          {toast}
        </div>
      )}

      {devices === null && !loadError ? (
        <LoadingSpinner size="large" label="Loading diagnostics..." />
      ) : loadError ? (
        <div className="p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-center">
          <XCircle className="w-7 h-7 text-red-500 mx-auto" />
          <p className="text-[15px] font-semibold mt-2">Couldn&apos;t load diagnostics</p>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Retry loading diagnostics"
            className="mt-3 px-5 py-2.5 rounded-[10px] bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (devices ?? []).length === 0 ? (
        <div className="text-center pt-15 px-8">
          <HelpCircle className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto" />
          <p className="text-base font-semibold mt-3">No devices yet</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            No devices with push tokens yet — open the app on a device while signed in.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(devices ?? []).map((d) => (
            <DeviceCard
              key={d.deviceId}
              device={d}
              isMine={d.deviceId === myDeviceId}
              testing={testingId === d.deviceId}
              onTest={(id) => void onTest(id)}
            />
          ))}
        </div>
      )}

      <Link
        to="/settings"
        className="inline-block text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
      >
        ← Back to Settings
      </Link>
    </div>
  );
}
