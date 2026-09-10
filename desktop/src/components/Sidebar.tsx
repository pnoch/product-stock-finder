import { useState, useEffect } from "react";
import { NavLink } from "react-router";
import { storage } from "../storage";
import {
  LayoutDashboard,
  List,
  Bell,
  BellRing,
  Search,
  Settings,
  BarChart3,
  Activity,
  Building2,
  LineChart,
  DollarSign,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Home" },
  { to: "/watchlist", icon: List, label: "Watchlist" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/restock-watches", icon: BellRing, label: "Restock Watches" },
  { to: "/search", icon: Search, label: "Search" },
  { to: "/rates", icon: DollarSign, label: "Rates" },
  { to: "/stats", icon: LineChart, label: "Stats" },
  { to: "/health", icon: Activity, label: "Health" },
  { to: "/distributor-analysis", icon: Building2, label: "Distributor Analysis" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const history = await storage.getNotificationHistory();
        setUnreadCount(history.filter((e) => !e.read).length);
      } catch {
        // best-effort — badge stays hidden
      }
    };
    void load();
    const onFocus = () => {
      void load();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return (
    <aside className="flex flex-col w-16 lg:w-56 h-screen bg-surface-light dark:bg-surface-dark border-r border-gray-200 dark:border-gray-700 shadow-sm shrink-0">
      <div className="flex items-center gap-2 px-4 h-16 shrink-0 border-b border-gray-200 dark:border-gray-700">
        <BarChart3 className="w-6 h-6 text-brand-600 shrink-0" />
        <span className="hidden lg:block font-semibold text-sm truncate">
          Product Stock Finder
        </span>
      </div>
      <nav className="flex-1 py-3 space-y-0.5 px-1.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <div key={to} className="relative group">
            <NavLink
              to={to}
              aria-label={label}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg border-l-[3px] transition-colors duration-150 ${
                  isActive
                    ? "bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 border-brand-600 dark:border-brand-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="hidden lg:block truncate">{label}</span>
              {to === "/alerts" && unreadCount > 0 && (
                <span className="absolute right-1.5 lg:static lg:ml-auto flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-brand-600 text-white text-[11px] font-semibold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </NavLink>
            <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded-md bg-gray-900 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 delay-500 lg:hidden z-50">
              {label}
            </span>
          </div>
        ))}
      </nav>
    </aside>
  );
}
