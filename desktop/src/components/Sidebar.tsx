import { NavLink } from "react-router";
import {
  LayoutDashboard,
  List,
  Bell,
  Search,
  Settings,
  BarChart3,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Home" },
  { to: "/watchlist", icon: List, label: "Watchlist" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/search", icon: Search, label: "Search" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="flex flex-col w-16 lg:w-56 h-screen bg-surface-light dark:bg-surface-dark border-r border-gray-200 dark:border-gray-700 shadow-sm shrink-0 transition-all duration-300 ease-in-out">
      <div className="flex items-center gap-2 px-4 h-16 shrink-0 border-b border-gray-200 dark:border-gray-700">
        <BarChart3 className="w-6 h-6 text-brand-600 shrink-0" />
        <span className="hidden lg:block font-semibold text-sm truncate">
          Product Stock Finder
        </span>
      </div>
      <nav className="flex-1 py-3 space-y-0.5 px-1.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            aria-label={label}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg border-l-[3px] transition-all duration-200 ease-in-out ${
                isActive
                  ? "bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 border-brand-600 dark:border-brand-400 font-medium shadow-sm"
                  : "text-gray-600 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-200 dark:hover:border-gray-700"
              }`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="hidden lg:block truncate">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
