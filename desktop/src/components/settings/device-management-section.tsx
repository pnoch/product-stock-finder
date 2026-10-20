import { useCallback, useEffect, useState } from "react";
import { LogOut, MonitorSmartphone, Pencil, X } from "lucide-react";
import type { DeviceInfo } from "../../../../server/devices";
import { formatLastSeen } from "../../../../lib/relative-time";
import { getDesktopDeviceId } from "../../lib/device-id";
import { createTRPCClient } from "../../lib/trpc";
import { useToast } from "../../hooks/use-toast";
import { DialogOverlay } from "../DialogOverlay";

export function DeviceManagementSection({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  const { showToast } = useToast();
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{
    deviceId: string;
    label: string | null;
  } | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [renaming, setRenaming] = useState(false);

  const loadDevices = useCallback(async () => {
    if (!isAuthenticated) return;
    setDevicesLoading(true);
    setDevicesError(null);
    try {
      const [devRes, curId] = await Promise.all([
        // Use the imperative client: `trpc.devices.list` is a React hook proxy
        // (no `.query()`), so calling it here always threw.
        createTRPCClient().devices.list.query(),
        getDesktopDeviceId(),
      ]);
      setDevices(devRes?.devices ?? []);
      setCurrentDeviceId(curId);
    } catch (e) {
      setDevicesError(e instanceof Error ? e.message : String(e));
      setDevices(null);
    } finally {
      setDevicesLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    queueMicrotask(() => {
      void loadDevices();
    });
  }, [isAuthenticated, loadDevices]);

  const handleRename = async () => {
    if (!renameTarget) return;
    const label = renameLabel.trim();
    if (!label) return;
    setRenaming(true);
    try {
      await createTRPCClient().devices.rename.mutate({
        deviceId: renameTarget.deviceId,
        label,
      });
      setRenameTarget(null);
      setRenameLabel("");
      await loadDevices();
      showToast("Device renamed");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setRenaming(false);
    }
  };

  const handleSignOutDevice = async (deviceId: string) => {
    if (!confirm("Sign out this device and remove it from your account?")) {
      return;
    }
    try {
      await createTRPCClient().devices.signOut.mutate({ deviceId });
      await loadDevices();
      showToast("Device signed out");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sign out failed");
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-3 mb-4">
        <MonitorSmartphone className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        <h2 className="text-lg font-semibold">Device Management</h2>
        <button
          onClick={loadDevices}
          className="ml-auto text-xs text-brand-600 hover:underline"
          aria-label="Reload devices"
        >
          Refresh
        </button>
      </div>
      {!devices && devicesLoading ? (
        <p className="text-sm text-gray-500">Loading devices…</p>
      ) : devicesError ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-amber-600">{devicesError}</p>
          <button
            onClick={loadDevices}
            className="text-sm text-brand-600 font-medium hover:underline"
          >
            Retry
          </button>
        </div>
      ) : devices && devices.length === 0 ? (
        <p className="text-sm text-gray-500">
          No other devices bound to your account.
        </p>
      ) : devices ? (
        <div className="space-y-2">
          {devices.map((d) => {
            const isCurrent = d.deviceId === currentDeviceId;
            return (
              <div
                key={d.deviceId}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isCurrent
                    ? "border-brand-200 bg-brand-50 dark:bg-brand-900/10 dark:border-brand-800"
                    : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {d.label ?? `${d.deviceId.slice(0, 12)}…`}
                    </p>
                    {isCurrent && (
                      <span className="inline-flex shrink-0 px-1.5 py-0.5 rounded-lg bg-brand-600/15 text-brand-600 dark:text-brand-400 text-[10px] font-semibold">
                        This device
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{d.deviceId}</p>
                  {d.lastSeenAt > 0 && (
                    <p className="text-xs text-gray-400">
                      {formatLastSeen(d.lastSeenAt)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => {
                      setRenameTarget(d);
                      setRenameLabel(d.label ?? "");
                    }}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-600"
                    aria-label={`Rename ${d.label ?? d.deviceId}`}
                    title="Rename"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {!isCurrent && (
                    <button
                      onClick={() => handleSignOutDevice(d.deviceId)}
                      className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                      aria-label={`Sign out ${d.label ?? d.deviceId}`}
                      title="Sign out"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {renameTarget && (
        <DialogOverlay
          open
          onClose={() => setRenameTarget(null)}
          label="Rename device"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Rename device</h3>
              <button
                onClick={() => setRenameTarget(null)}
                aria-label="Close"
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              value={renameLabel}
              onChange={(e) => setRenameLabel(e.target.value)}
              maxLength={64}
              placeholder="Device label"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRenameTarget(null)}
                className="px-3 py-2 rounded-lg border text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={renaming || !renameLabel.trim()}
                className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm disabled:opacity-50"
              >
                {renaming ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
}
