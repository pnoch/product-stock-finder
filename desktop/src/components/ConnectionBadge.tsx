type ConnectionStatus = "connected" | "signed-out" | "offline" | "local";

const CONFIG: Record<
  ConnectionStatus,
  { label: string; dotClass: string; textClass: string; borderClass: string }
> = {
  connected: {
    label: "Connected",
    dotClass: "bg-emerald-500 shadow-emerald-500/30",
    textClass: "text-emerald-700 dark:text-emerald-400",
    borderClass: "border-emerald-200 dark:border-emerald-800",
  },
  "signed-out": {
    label: "Signed out",
    dotClass: "bg-amber-500 shadow-amber-500/30",
    textClass: "text-amber-700 dark:text-amber-400",
    borderClass: "border-amber-200 dark:border-amber-800",
  },
  offline: {
    label: "Offline",
    dotClass: "bg-red-500 shadow-red-500/30",
    textClass: "text-red-700 dark:text-red-400",
    borderClass: "border-red-200 dark:border-red-800",
  },
  local: {
    label: "Local mode",
    dotClass: "bg-gray-400",
    textClass: "text-gray-500 dark:text-gray-400",
    borderClass: "border-gray-200 dark:border-gray-700",
  },
};

export function ConnectionBadge({
  status,
  onPress,
}: {
  status: ConnectionStatus;
  onPress?: () => void;
}) {
  const c = CONFIG[status] ?? CONFIG.local;
  const Component = onPress ? "button" : "div";
  return (
    <Component
      onClick={onPress}
      disabled={!onPress ? undefined : false}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-white dark:bg-gray-800 ${c.borderClass} ${c.textClass} ${onPress ? "cursor-pointer hover:opacity-80" : ""}`}
      aria-label={onPress ? `Connection status: ${c.label}` : undefined}
    >
      <span
        className={`w-2 h-2 rounded-full shadow-sm ${c.dotClass}`}
        aria-hidden
      />
      {c.label}
    </Component>
  );
}
