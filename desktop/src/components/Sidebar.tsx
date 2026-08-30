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
    <aside className="flex flex-col w-16 lg:w-56 h-screen bg-surface-light dark:bg-surface-dark border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-200 dark:border-gray-700">
        <BarChart3 className="w-6 h-6 text-brand-600" />
        <span className="hidden lg:block font-semibold text-sm">
          Product Stock Finder
        </span>
      </div>
      <nav className="flex-1 py-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={label}
            aria-label={label}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                isActive
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="hidden lg:block">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
