import { Link } from "react-router";
import {
  BarChart3,
  Bell,
  BellRing,
  CircleCheck,
  Clock,
  Sparkles,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { formatRelativeTime } from "../../../../lib/relative-time";
import type { NotificationHistoryEntry } from "../../../../lib/types";
import { EmptyState } from "../EmptyState";

const TYPE_ICONS = {
  price_drop: TrendingDown,
  price_rise: TrendingUp,
  restock: CircleCheck,
  reminder: Clock,
  health: TriangleAlert,
  digest: BarChart3,
  suspicious_price: TriangleAlert,
  criterion_match: Sparkles,
} as const;

export function NotificationsTab({
  notifications,
  unreadCount,
  notifError,
  refreshing,
  onRefresh,
  onMarkAllRead,
  onOpen,
  onRetry,
}: {
  notifications: NotificationHistoryEntry[];
  unreadCount: number;
  notifError: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  onOpen: (notification: NotificationHistoryEntry) => void;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">On desktop, notifications route to system tray</p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Alerts, restocks, and reminders appear as native OS notifications when the app is running.</p>
        </div>
        <Link to="/settings" className="shrink-0 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40">Settings</Link>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{unreadCount > 0 ? `${unreadCount} unread` : notifications.length > 0 ? "All caught up" : "No notifications yet"}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh notifications"
            className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50"
          >
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
          {unreadCount > 0 && (
            <button onClick={onMarkAllRead} className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">Mark all read</button>
          )}
        </div>
      </div>
      {notifError && (
        <div role="alert" className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-800 dark:text-red-200 flex items-center gap-2">
          <span className="flex-1">{notifError}</span>
          <button
            onClick={onRetry}
            className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800 text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-700 shrink-0"
            aria-label="Retry loading notifications"
          >
            Retry
          </button>
        </div>
      )}
      {notifications.length === 0 ? (
        <EmptyState icon={<BellRing className="w-12 h-12" />} title="No notifications yet" description="Price alerts and restock updates will appear here and in your system tray." />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const route =
              n.type === "health"
                ? n.distributorId
                  ? `/health/${n.distributorId}`
                  : "/health"
                : n.type === "digest"
                  ? "/stats"
                  : n.productId
                    ? `/product/${n.productId}`
                    : null;
            const itemClassName = `flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border ${n.read ? "border-gray-200 dark:border-gray-700" : "border-brand-200 dark:border-brand-800 bg-brand-50/40 dark:bg-brand-900/10"} `;
            const TypeIcon =
              n.type === "health" && n.healthStatus === "recovered"
                ? CircleCheck
                : TYPE_ICONS[n.type] ?? Bell;
            const content = (
              <>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${n.type === "health" ? (n.healthStatus === "recovered" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400" : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400") : n.type === "reminder" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"}`}>
                  <TypeIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{n.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{n.body}</p>
                  <p className="text-[11px] text-gray-400 mt-1" title={new Date(n.createdAt).toLocaleString()}>{formatRelativeTime(n.createdAt)}</p>
                </div>
                {!n.read && <span className="w-2.5 h-2.5 rounded-full bg-brand-600 shrink-0" aria-label="Unread" />}
              </>
            );
            return route ? (
              <Link key={n.id} to={route} onClick={() => onOpen(n)} className={itemClassName}>
                {content}
              </Link>
            ) : (
              <div
                key={n.id}
                className={`${itemClassName} cursor-pointer`}
                onClick={() => onOpen(n)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(n);
                  }
                }}
              >
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
