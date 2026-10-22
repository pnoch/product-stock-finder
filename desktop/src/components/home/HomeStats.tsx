import { Bell, Clock, Package, TrendingUp } from "lucide-react";
import { StatCard } from "./StatCard";

export function HomeStats({
  tracked,
  inStock,
  activeAlerts,
  reminders,
  onNavigate,
}: {
  tracked: number;
  inStock: number;
  activeAlerts: number;
  reminders: number;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<Package className="w-5 h-5" />}
        label="Tracked"
        value={tracked}
        delay={0}
        onClick={() => onNavigate("/watchlist")}
      />
      <StatCard
        icon={<TrendingUp className="w-5 h-5" />}
        label="In Stock"
        value={inStock}
        delay={80}
        onClick={() => onNavigate("/watchlist?inStock=1")}
      />
      <StatCard
        icon={<Bell className="w-5 h-5" />}
        label="Alerts"
        value={activeAlerts}
        delay={160}
        onClick={() => onNavigate("/alerts?tab=alerts")}
      />
      <StatCard
        icon={<Clock className="w-5 h-5" />}
        label="Reminders"
        value={reminders}
        delay={240}
        onClick={() => onNavigate("/alerts?tab=reminders")}
      />
    </div>
  );
}
