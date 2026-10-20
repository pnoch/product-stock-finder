import { Platform, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SummaryCard } from "@/components/watchlist/summary-card";
import { SearchBar } from "@/components/watchlist/search-bar";
import { ProgressBar } from "@/components/watchlist/progress-bar";
import { SortGroupBar } from "@/components/watchlist/sort-group-bar";
import type { WatchlistSummary } from "@/lib/watchlist-summary";
import type { StatusFilter } from "@/lib/watchlist-org";
import type { WatchlistGroup, WatchlistSort } from "@/lib/types";

type WatchlistListHeaderProps = {
  watchlistLength: number;
  summary: WatchlistSummary;
  displayCurrency: string;
  statusFilter: StatusFilter;
  onStatusToggle: (status: StatusFilter) => void;
  onViewStats: () => void;
  onPlanOrder: () => void;
  onSourcing: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  checking: boolean;
  checkProgress: { current: number; total: number } | null;
  sortMode: WatchlistSort;
  groupMode: WatchlistGroup;
  sortMenuOpen: boolean;
  onSortModeChange: (mode: WatchlistSort) => void;
  onGroupModeChange: (mode: WatchlistGroup) => void;
  onSortMenuToggle: () => void;
  filtersExpanded: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  filterPanel: React.ReactNode;
  offline: boolean;
  queuedCount: number;
};

export function WatchlistListHeader({
  watchlistLength,
  summary,
  displayCurrency,
  statusFilter,
  onStatusToggle,
  onViewStats,
  onPlanOrder,
  onSourcing,
  query,
  onQueryChange,
  checking,
  checkProgress,
  sortMode,
  groupMode,
  sortMenuOpen,
  onSortModeChange,
  onGroupModeChange,
  onSortMenuToggle,
  filtersExpanded,
  onToggleFilters,
  activeFilterCount,
  filterPanel,
  offline,
  queuedCount,
}: WatchlistListHeaderProps) {
  const colors = useColors();
  return (
<View>
{offline && queuedCount > 0 && (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.warning + "14",
      borderWidth: 1,
      borderColor: colors.warning + "44",
      borderRadius: 16,
      marginHorizontal: 20,
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    }}
    accessibilityLabel={`Offline — ${queuedCount} edits queued`}
    accessibilityRole="alert"
  >
    <IconSymbol name="wifi.slash" size={16} color={colors.warning} />
    <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", flex: 1 }}>
      Offline — {queuedCount} edit{queuedCount !== 1 ? "s" : ""} queued
    </Text>
    <Text style={{ color: colors.muted, fontSize: 12 }}>Will sync when back online</Text>
  </View>
)}
{watchlistLength > 0 && (
  <SummaryCard
    summary={summary}
    displayCurrency={displayCurrency}
    statusFilter={statusFilter}
    onStatusToggle={onStatusToggle}
    onViewStats={onViewStats}
  />
)}
{watchlistLength >= 2 && (
  <View
    style={{
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    }}
  >
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        if (Platform.OS !== "web")
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPlanOrder();
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
      accessibilityLabel="Plan order"
      accessibilityRole="button"
    >
      <IconSymbol name="cart.fill" size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}
        >
          Plan order
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
          Find the cheapest way to buy your watchlist at once
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={12} color={colors.muted} />
    </TouchableOpacity>
  </View>
)}
{watchlistLength > 0 && (
  <View
    style={{
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    }}
  >
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        if (Platform.OS !== "web")
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onSourcing();
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
      accessibilityLabel="Sourcing sheet"
      accessibilityRole="button"
    >
      <IconSymbol
        name="dollarsign.circle.fill"
        size={20}
        color={colors.primary}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.foreground, fontSize: 15, fontWeight: "600" }}
        >
          Sourcing sheet
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
          Track buy prices, sell targets, and margin
        </Text>
      </View>
      <IconSymbol name="chevron.right" size={12} color={colors.muted} />
    </TouchableOpacity>
  </View>
)}
{watchlistLength > 0 && (
  <SearchBar query={query} onQueryChange={onQueryChange} />
)}
<ProgressBar
  progress={
    checkProgress ? checkProgress.current / checkProgress.total : 0
  }
  visible={!!(checking && checkProgress)}
/>
{watchlistLength > 0 && (
  <SortGroupBar
    sortMode={sortMode}
    groupMode={groupMode}
    sortMenuOpen={sortMenuOpen}
    onSortModeChange={onSortModeChange}
    onGroupModeChange={onGroupModeChange}
    onSortMenuToggle={onSortMenuToggle}
  />
)}
{watchlistLength > 0 && (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={() => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onToggleFilters();
    }}
    style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginBottom: filtersExpanded ? 8 : 10,
      paddingHorizontal: 12,
      minHeight: 56,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: filtersExpanded ? colors.primary : colors.border,
    }}
    accessibilityLabel={activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"}
    accessibilityRole="button"
    accessibilityState={{ expanded: filtersExpanded }}
  >
    <IconSymbol
      name="line.3.horizontal.decrease.circle"
      size={18}
      color={filtersExpanded || activeFilterCount > 0 ? colors.primary : colors.muted}
    />
    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600", flex: 1 }}>
      Filters
    </Text>
    {activeFilterCount > 0 && (
      <View
        style={{
          minWidth: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 6,
        }}
        accessibilityLabel={`${activeFilterCount} filters active`}
      >
        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
          {activeFilterCount}
        </Text>
      </View>
    )}
    <IconSymbol name={filtersExpanded ? "chevron.up" : "chevron.down"} size={16} color={colors.muted} />
  </TouchableOpacity>
)}
{filterPanel}
    </View>
  );
}
