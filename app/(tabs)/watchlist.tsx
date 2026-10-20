import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  SectionList,
  Text,
  View,
  RefreshControl,
  Alert,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { showAlert } from "@/lib/alert";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useSettings } from "@/lib/settings-provider";
import { WatchlistFilterPanel } from "@/components/watchlist/watchlist-filter-panel";
import { WatchlistListHeader } from "@/components/watchlist/watchlist-list-header";
import { pickAndImportWatchlistCsv } from "@/lib/watchlist-import";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { PaywallScreen } from "@/components/paywall/paywall-screen";
import { track } from "@/lib/telemetry";
import { useLiveWatchlist } from "@/hooks/use-live-prices";
import { useConnection } from "@/hooks/use-connection";
import { buildWatchlistShareMessage } from "@/lib/watchlist-share";
import { shareText } from "@/lib/share-text";
import { trpc } from "@/lib/trpc";
import {
  updateSettings,
  getAlerts,
  addToWatchlist,
  addAlert,
  addBackOrderReminder,
  addStockWatch,
  getBackOrderReminders,
  getStockWatches,
  removeFromWatchlist,
  getSyncMeta,
  updateProductListings,
  updateProductAcquired,
} from "@/lib/storage";
import { rediscoverProduct } from "@/lib/manual-add";
import { discoverListings } from "@/lib/listing-discovery";
import { useToast } from "@/components/ui/toast";
import { scheduleBackOrderReminder } from "@/lib/notifications";
import { countQueuedEdits } from "@/lib/sync";
import { computeWatchlistSummary } from "@/lib/watchlist-summary";
import { computeProductInsights } from "@/lib/product-insights";
import { computeDealScore } from "@/lib/deal-score";
import {
  BackOrderReminder,
  PriceAlert,
  Product,
  WatchlistGroup,
  WatchlistSort,
} from "@/lib/types";
import { checkPriceDropsNow } from "@/lib/background-price-check";
import { getAllRegions } from "@/lib/region-filter";
import { TagPickerSheet } from "@/components/tag-picker-sheet";
import { TagManageSheet } from "@/components/tag-manage-sheet";
import { BulkTagSheet } from "@/components/bulk-tag-sheet";
import {
  filterWatchlist,
  groupWatchlist,
  sortWatchlist,
  countTagMatches,
  type StatusFilter,
} from "@/lib/watchlist-org";
import { ProductCard } from "@/components/watchlist/product-card";
import { isAcquired } from "@/lib/acquired";
import { SwipeableCard } from "@/components/watchlist/swipeable-card";
import { WatchlistHeader } from "@/components/watchlist/watchlist-header";
import { EmptyState } from "@/components/watchlist/empty-state";
import { SkeletonList } from "@/components/ui/skeleton";
import { LOG_ERROR, log } from "@shared/log";

// The header content lives in the list's ListHeaderComponent so it scrolls
// away with the content (QA round 8: as flex siblings it squeezed the list
// into a ~240px strip at the bottom of the screen).
export default function WatchlistScreen() {
  const router = useRouter();
  const colors = useColors();
  const { showToast } = useToast();
  const { settings, loading: settingsLoading } = useSettings();
  const insets = useSafeAreaInsets();
  const {
    products: watchlist,
    loaded,
    isRefreshingAny,
    reload,
    refreshAll,
  } = useLiveWatchlist();
  const { isAuthenticated } = useAuth();
  const { isPro } = useEntitlements();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const createShareLink = trpc.sharedWatchlists.create.useMutation();
  const [sortMode, setSortMode] = useState<WatchlistSort>("recent");
  const [groupMode, setGroupMode] = useState<WatchlistGroup>("off");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const displayCurrency = settings.displayCurrency;
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showAcquired, setShowAcquired] = useState(false);
  // Collapsed filter bar (Plan D Task 2): null = auto (expanded when any
  // filter is active, collapsed otherwise); once the user toggles, the choice
  // persists for the session (no storage).
  const [filtersManual, setFiltersManual] = useState<boolean | null>(null);
  // Alert presence drives the swipe-action label ("Alert"/"Muted").
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number] | undefined>(undefined);
  const [priceMinInput, setPriceMinInput] = useState("");
  const [priceMaxInput, setPriceMaxInput] = useState("");
  const tagDefinitions = useMemo(
    () => settings.tagDefinitions ?? {},
    [settings.tagDefinitions],
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  if (!hydrated && !settingsLoading) {
    setHydrated(true);
    setSortMode(settings.watchlistSort ?? "recent");
    setGroupMode(settings.watchlistGroup ?? "off");
    setInStockOnly(settings.watchlistInStockOnly ?? false);
    const storedRange = settings.watchlistPriceRange ?? null;
    if (storedRange && Array.isArray(storedRange) && storedRange.length === 2) {
      const [min, max] = storedRange;
      const isMaxFinite =
        Number.isFinite(max) && max !== Number.MAX_SAFE_INTEGER;
      setPriceRange([min, max]);
      setPriceMinInput(min === 0 ? "" : String(min));
      setPriceMaxInput(isMaxFinite ? String(max) : "");
    }
  }
  const [tagMatchMode, setTagMatchMode] = useState<"any" | "all">("any");
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [manageVisible, setManageVisible] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagVisible, setBulkTagVisible] = useState(false);
  const [findingIds, setFindingIds] = useState<Set<string>>(new Set());
  const [undoProduct, setUndoProduct] = useState<Product | null>(null);
  // Everything the removal cascade deletes for a product, so Undo can restore
  // it (removeFromWatchlist also drops alerts, back-order reminders, and
  // restock watches).
  const undoAlertsRef = useRef<PriceAlert[]>([]);
  const undoRemindersRef = useRef<BackOrderReminder[]>([]);
  const undoWatchesRef = useRef<BackOrderReminder[]>([]);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkingRef = useRef(false);
  const regions = useMemo(() => getAllRegions(), []);
  const scrollY = useState(() => new Animated.Value(0))[0];
  const headerCollapse = scrollY.interpolate({ inputRange: [0, 80], outputRange: [1, 0], extrapolate: "clamp" });
  const connection = useConnection();
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refreshQueue = async () => {
      try {
        const meta = await getSyncMeta();
        if (!cancelled) setQueuedCount(countQueuedEdits(meta));
      } catch (e) {
        LOG_ERROR("[Watchlist] queued-count refresh failed", e);
      }
    };
    void refreshQueue();
    const interval = setInterval(refreshQueue, 30000);
    const onFocus = () => void refreshQueue();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshQueue();
    };
    if (Platform.OS === "web") {
      window.addEventListener("focus", onFocus);
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (Platform.OS === "web") {
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [watchlist.length]);

  const reloadAlerts = useCallback(async () => {
    try {
      setAlerts(await getAlerts());
    } catch (e) {
      log.error("[Watchlist] alerts reload failed", e);
    }
  }, []);
  const loadData = useCallback(async () => {
    await reloadAlerts();
  }, [reloadAlerts]);

  // Real-time price range filter without Apply — updates as user types
  useEffect(() => {
    if (!hydrated) return;
    const minStr = priceMinInput.trim();
    const maxStr = priceMaxInput.trim();
    if (minStr === "" && maxStr === "") {
      // Latch the last valid range while the user types; deriving this would
      // clear the filter on an intermediate invalid value.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPriceRange(undefined);
      return;
    }
    const min = minStr === "" ? 0 : Number(minStr);
    const max = maxStr === "" ? Infinity : Number(maxStr);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0 || min > max) {
      return;
    }
    const effectiveMax = max === Infinity ? Number.MAX_SAFE_INTEGER : max;
    setPriceRange((prev) => {
      if (prev && prev[0] === min && prev[1] === effectiveMax) return prev;
      return [min, effectiveMax];
    });
  }, [hydrated, priceMinInput, priceMaxInput]);

  // Persist priceRange / inStockOnly to AppSettings (real-time). Uses the
  // serialized updateSettings: a whole-object saveSettings with a read taken
  // outside the write queue raced the sort/group persist below, so changing
  // both quickly dropped one field.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const persist = async () => {
      try {
        if (!cancelled) {
          await updateSettings({
            watchlistInStockOnly: inStockOnly,
            watchlistPriceRange: priceRange ?? null,
          });
        }
      } catch (e) {
        LOG_ERROR("[Watchlist] settings persist failed", e);
      }
    };
    void persist();
    return () => { cancelled = true; };
  }, [hydrated, inStockOnly, priceRange]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      void loadData();
    }, [reload, loadData]),
  );

  const validSelectedTagIds = useMemo(
    () => selectedTagIds.filter((id) => tagDefinitions[id]),
    [selectedTagIds, tagDefinitions],
  );

  const filteredWatchlist = useMemo(
    () =>
      filterWatchlist(watchlist, {
        region: regionFilter,
        tagIds: validSelectedTagIds,
        tagMatchMode,
        status: statusFilter,
        query,
        priceRange,
        inStockOnly,
        displayCurrency,
      }).filter((p) => showAcquired || !isAcquired(p)),
    [watchlist, regionFilter, validSelectedTagIds, tagMatchMode, statusFilter, query, priceRange, inStockOnly, displayCurrency, showAcquired],
  );

  const tagCounts = useMemo(
    () =>
      countTagMatches(watchlist, {
        region: regionFilter,
        status: statusFilter,
        query,
        priceRange,
        inStockOnly,
        displayCurrency,
      }),
    [watchlist, regionFilter, statusFilter, query, priceRange, inStockOnly, displayCurrency],
  );

  const sections = useMemo(
    () =>
      groupWatchlist(
        sortWatchlist(filteredWatchlist, sortMode, displayCurrency),
        groupMode,
        tagDefinitions,
      ),
    [filteredWatchlist, sortMode, groupMode, tagDefinitions, displayCurrency],
  );

  const summary = useMemo(
    () => computeWatchlistSummary(watchlist, displayCurrency),
    [watchlist, displayCurrency],
  );

  const insightMap = useMemo(() => {
    const result = computeProductInsights(watchlist, displayCurrency);
    return new Map(result.products.map((p) => [p.productId, p] as const));
  }, [watchlist, displayCurrency]);

  const dealScoreMap = useMemo(() => {
    return new Map(
      watchlist.map(
        (p) =>
          [p.id, computeDealScore(p.listings ?? [], displayCurrency)] as const,
      ),
    );
  }, [watchlist, displayCurrency]);

  const toggleTagFilter = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  }, []);

  // Number of non-default filters driving the Filters button badge. Each
  // dimension counts at most 1: query, tags, status, price, region,
  // in-stock-on, and show-acquired-on.
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (query.trim() !== "") count += 1;
    if (selectedTagIds.length > 0) count += 1;
    if (statusFilter !== "all") count += 1;
    if (priceRange !== undefined || priceMinInput !== "" || priceMaxInput !== "") count += 1;
    if (regionFilter !== "all") count += 1;
    if (inStockOnly) count += 1;
    if (showAcquired) count += 1;
    return count;
  }, [query, selectedTagIds, statusFilter, priceRange, priceMinInput, priceMaxInput, regionFilter, inStockOnly, showAcquired]);

  const filtersExpanded = filtersManual ?? activeFilterCount > 0;

  const clearAllFilters = useCallback(() => {
    setRegionFilter("all");
    setSelectedTagIds([]);
    setStatusFilter("all");
    setInStockOnly(false);
    setPriceRange(undefined);
    setPriceMinInput("");
    setPriceMaxInput("");
    setQuery("");
    setShowAcquired(true);
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAcquired = useCallback(
    async (product: Product) => {
      try {
        await updateProductAcquired(
          product.id,
          isAcquired(product) ? null : new Date().toISOString(),
        );
        await reload();
      } catch (e) {
        log.error("[Watchlist] toggle acquired failed", e);
        showAlert("Update failed", "We couldn't update that product. Please try again.");
      }
    },
    [reload],
  );

  // Swipe "Alert" action: alerts are created on the product detail screen
  // (the watch row itself has no alert composer), so the swipe opens it.
  const handleSwipeAlert = useCallback((product: Product) => {
    router.push(`/product/${product.id}`);
  }, [router]);

  const alertProductIds = useMemo(
    () => new Set(alerts.filter((a) => a.isActive && !a.triggeredAt).map((a) => a.productId)),
    [alerts],
  );

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleRefreshAll = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ok = await refreshAll();
    if (!ok) {
      showAlert(
        "Couldn't refresh prices",
        "The server is unreachable. Showing saved prices.",
      );
    }
  }, [refreshAll]);

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    const count = ids.length;
    const doRemove = async () => {
      try {
        if (Platform.OS !== "web")
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        for (const id of ids) await removeFromWatchlist(id);
        await reload();
        exitSelection();
      } catch (e) {
        log.error("[Watchlist] bulk delete failed", e);
        showAlert(
          "Delete Failed",
          "Could not remove some products. Please try again.",
        );
      }
    };
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(
          `Remove ${count} product${count !== 1 ? "s" : ""} from your watchlist?`,
        )
      ) {
        void doRemove();
      }
      return;
    }
    Alert.alert(
      "Remove Products",
      `Remove ${count} product${count !== 1 ? "s" : ""} from your watchlist?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: doRemove },
      ],
    );
  }, [selectedIds, reload, exitSelection]);

  const handleBulkTagChanged = useCallback(() => {
    void reload();
    void loadData();
    exitSelection();
  }, [reload, loadData, exitSelection]);

  const showUndoBar = useCallback(
    (
      product: Product,
      alerts: PriceAlert[] = [],
      reminders: BackOrderReminder[] = [],
      watches: BackOrderReminder[] = [],
    ) => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoAlertsRef.current = alerts;
      undoRemindersRef.current = reminders;
      undoWatchesRef.current = watches;
      setUndoProduct(product);
      undoTimer.current = setTimeout(() => setUndoProduct(null), 5000);
    },
    [],
  );

  // Capture everything the removal cascade will delete, remove the product, then
  // offer Undo. Shared by the card's Delete button and the swipe action so both
  // give the same recovery (the card's Delete used to remove with no undo).
  const removeProductWithUndo = useCallback(
    async (product: Product) => {
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      try {
        const [allAlerts, allReminders, allWatches] = await Promise.all([
          getAlerts(),
          getBackOrderReminders(),
          getStockWatches(),
        ]);
        const removedAlerts = allAlerts.filter((a) => a.productId === product.id);
        const removedReminders = allReminders.filter((r) => r.productId === product.id);
        const removedWatches = allWatches.filter((w) => w.productId === product.id);
        await removeFromWatchlist(product.id);
        await reload();
        await reloadAlerts();
        showUndoBar(product, removedAlerts, removedReminders, removedWatches);
      } catch (e) {
        log.error("[Watchlist] remove failed", e);
        showAlert("Remove failed", "We couldn't remove that product. Please try again.");
      }
    },
    [reload, reloadAlerts, showUndoBar],
  );

  const handleDelete = useCallback(
    (product: Product) => {
      const doRemove = () => void removeProductWithUndo(product);
      if (Platform.OS === "web") {
        if (
          typeof window !== "undefined" &&
          window.confirm(`Remove "${product.name}" from your watchlist?`)
        ) {
          doRemove();
        }
        return;
      }
      Alert.alert(
        "Remove Product",
        `Remove "${product.name}" from your watchlist?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: doRemove },
        ],
      );
    },
    [removeProductWithUndo],
  );

  const handleUndo = useCallback(async () => {
    if (!undoProduct) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoProduct(null);
    try {
      await addToWatchlist(undoProduct);
      // Restore everything the removal cascade deleted, not just the alerts.
      for (const alert of undoAlertsRef.current) {
        await addAlert(alert);
      }
      for (const reminder of undoRemindersRef.current) {
        // The cascade cancelled the scheduled notification. Restoring the row
        // with the dead id would leave a reminder that never fires, so
        // re-schedule it (only for a future date) and store the new id.
        let notificationId = reminder.notificationId;
        const when = new Date(reminder.reminderDate);
        if (!Number.isNaN(when.getTime()) && when.getTime() > Date.now()) {
          const notifId = await scheduleBackOrderReminder(
            reminder.productName,
            reminder.distributorName,
            when,
            reminder.productId,
          ).catch(() => null);
          // The cascade cancelled the old schedule, so a failed re-schedule
          // must not keep the dead id: the row would look armed but never fire.
          notificationId = notifId ?? undefined;
        }
        await addBackOrderReminder({ ...reminder, notificationId });
      }
      for (const watch of undoWatchesRef.current) {
        // Stock watches are detected from status changes, not the (cancelled)
        // confirmation id, so restoring the row as-is is enough.
        await addStockWatch(watch);
      }
      undoAlertsRef.current = [];
      undoRemindersRef.current = [];
      undoWatchesRef.current = [];
      await reload();
      await reloadAlerts();
    } catch (e) {
      log.error("[Watchlist] undo failed", e);
      showAlert("Undo failed", "We couldn't restore that product. Please try again.");
    }
  }, [undoProduct, reload, reloadAlerts]);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const handleCheckNow = useCallback(async () => {
    if (checkingRef.current || watchlist.length === 0) return;
    checkingRef.current = true;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setChecking(true);
    setCheckProgress({ current: 0, total: watchlist.length });
    try {
      await checkPriceDropsNow((current, total) => {
        setCheckProgress({ current, total });
      });
      await reload();
      await refreshAll();
      await loadData();
    } catch (e) {
      log.error("[Watchlist] check now failed", e);
      showAlert("Check failed", "We couldn't check prices. Please try again.");
    } finally {
      checkingRef.current = false;
      setChecking(false);
      setCheckProgress(null);
    }
  }, [watchlist.length, reload, refreshAll, loadData]);

  const handleShareWatchlist = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // Prefer a server /w/ link when signed in so recipients can open the
      // full list; fall back to the local text summary when signed out or
      // offline. Link creation must never break sharing.
      let shareUrl: string | undefined;
      if (isAuthenticated) {
        try {
          const res = await createShareLink.mutateAsync({});
          shareUrl = res.shareUrl;
        } catch {
          shareUrl = undefined;
        }
      }
      const message = buildWatchlistShareMessage({ shareUrl, watchlist, displayCurrency, days: 30, now: Date.now() });
      const result = await shareText(message, "My Watchlist");
      if (result === "copied") showAlert("Copied", "Watchlist copied to your clipboard.");
      else if (result === "failed") showAlert("Share unavailable", "Sharing isn't supported in this browser.");
    } catch (e) {
      LOG_ERROR("[Watchlist] share failed", e);
    }
  }, [watchlist, displayCurrency, isAuthenticated, createShareLink]);

  const handleImportCsv = useCallback(async () => {
    try {
      const result = await pickAndImportWatchlistCsv({ isPro });
      if (result.status === "canceled") return;
      if (result.status === "empty") {
        showAlert("Import failed", "CSV file is empty.");
        return;
      }
      if (result.status === "invalid") {
        showAlert(
          "Import failed",
          "No valid rows found. Expected header: model,targetPrice,currency,tags",
        );
        return;
      }
      if (result.truncated) {
        showAlert(
          "Large file",
          `Only the first ${result.rows} rows were imported. Split the file and import the rest separately.`,
        );
      }
      await reload();
      await loadData();
      if (result.limited) {
        track("paywall_shown");
        setPaywallVisible(true);
        showAlert(
          "Import limited",
          `Added ${result.added} product${result.added === 1 ? "" : "s"} — upgrade to Pro to import the rest.`,
        );
        return;
      }
      const notes = [
        result.duplicates > 0 ? `${result.duplicates} already tracked` : "",
        result.skipped > 0 ? `${result.skipped} skipped` : "",
      ]
        .filter(Boolean)
        .join(", ");
      showAlert(
        "Import complete",
        `Added ${result.added} product${result.added !== 1 ? "s" : ""}${notes ? `, ${notes}` : ""}.`,
      );
    } catch (e) {
      LOG_ERROR("[Watchlist] import failed", e);
      showAlert("Import failed", e instanceof Error ? e.message : String(e));
    }
  }, [reload, loadData, isPro]);

  const handleFindPrices = useCallback(
    async (product: Product) => {
      if (!product.modelNumber) return;
      if (findingIds.has(product.id)) return;
      setFindingIds((prev) => new Set(prev).add(product.id));
      try {
        const { discovered, timedOut } = await rediscoverProduct({
          storage: { updateProductListings },
          discover: discoverListings,
          productId: product.id,
          modelNumber: product.modelNumber,
        });
        await reload();
        showToast(
          discovered > 0
            ? `Found prices at ${discovered} distributor${discovered === 1 ? "" : "s"}`
            : timedOut
              ? "Search timed out — try again"
              : "No prices found",
          discovered > 0 ? "success" : "error",
        );
      } catch (e) {
        LOG_ERROR("[Watchlist] price discovery failed", e);
        showToast("Couldn't find prices", "error");
      } finally {
        setFindingIds((prev) => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
      }
    },
    [findingIds, reload, showToast],
  );

  const sortModeRef = useRef(sortMode);
  const groupModeRef = useRef(groupMode);
  useEffect(() => {
    sortModeRef.current = sortMode;
  }, [sortMode]);
  useEffect(() => {
    groupModeRef.current = groupMode;
  }, [groupMode]);
  const persistViewPrefs = useCallback(
    async (sort: WatchlistSort, group: WatchlistGroup) => {
      // Serialized updateSettings shares the storage write queue with the
      // in-stock/price-range persist above, so the two cannot clobber each
      // other's fields.
      try {
        await updateSettings({ watchlistSort: sort, watchlistGroup: group });
      } catch (e) {
        log.error("[Watchlist] persistViewPrefs failed", e);
      }
    },
    [],
  );

  const sectionData = useMemo(() => sections.map((s) => ({ ...s, data: s.products.map((p) => ({ ...p, _sectionKey: s.key } as Product & { _sectionKey: string })) })), [sections]);
  const handleProductPress = useCallback((product: Product) => {
    if (selectionMode) toggleSelection(product.id);
    else router.push(`/product/${product.id}`);
  }, [selectionMode, toggleSelection, router]);
  const handleProductLongPress = useCallback((product: Product) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectionMode(true);
    setSelectedIds(new Set([product.id]));
  }, []);
  const renderSectionHeader = useCallback(({ section }: { section: { key: string; title: string; products: Product[] } }) => {
    if (groupMode === "off") return null;
    const tag = groupMode === "tag" ? tagDefinitions[section.key.replace('tag-', '')] : undefined;
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, backgroundColor: colors.background }}>
        {tag && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tag.color }} />}
        <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 }} numberOfLines={1} ellipsizeMode="tail">{section.title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>· {section.products.length}</Text>
      </View>
    );
  }, [groupMode, tagDefinitions, colors.background, colors.muted]);

  // Memoized so unrelated state changes (sheets, query, prefs) don't rebuild and
  // re-render every visible row; combined with the stabilized `liveProducts` in
  // use-live-prices this keeps the SectionList cheap on large watchlists.
  const renderItem = useCallback(
    ({ item }: { item: Product & { _sectionKey?: string } }) => (
      <SwipeableCard
        enabled={!selectionMode}
        onDelete={() => handleDelete(item)}
        onToggleAlert={() => handleSwipeAlert(item)}
        onToggleAcquired={() => void handleToggleAcquired(item)}
        isAcquired={isAcquired(item)}
        hasAlert={alertProductIds.has(item.id)}
      >
        <ProductCard
          product={item}
          displayCurrency={displayCurrency}
          selectionMode={selectionMode}
          insight={
            insightMap.has(item.id)
              ? {
                  atAllTimeLow: insightMap.get(item.id)!.atAllTimeLow,
                  dropStreak: insightMap.get(item.id)!.dropStreak,
                }
              : undefined
          }
          dealScore={dealScoreMap.get(item.id) ?? undefined}
          selected={selectedIds.has(item.id)}
          onPress={() => handleProductPress(item)}
          onLongPress={() => handleProductLongPress(item)}
          onDelete={() => handleDelete(item)}
          onTagPress={() => setPickerProduct(item)}
          onFindPrices={() => handleFindPrices(item)}
          findingPrices={findingIds.has(item.id)}
          tagDefinitions={tagDefinitions}
          onToggleAcquired={() => void handleToggleAcquired(item)}
        />
      </SwipeableCard>
    ),
    [
      selectionMode,
      displayCurrency,
      insightMap,
      dealScoreMap,
      selectedIds,
      findingIds,
      tagDefinitions,
      handleProductPress,
      handleProductLongPress,
      handleDelete,
      handleFindPrices,
      handleToggleAcquired,
      handleSwipeAlert,
      alertProductIds,
    ],
  );

  if (!loaded) {
    return (
      <ScreenContainer>
        <View style={{ paddingTop: 16 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                width: 120,
                height: 20,
                borderRadius: 8,
                backgroundColor: colors.border,
                opacity: 0.5,
              }}
            />
            <View
              style={{
                width: 80,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.border,
                opacity: 0.5,
              }}
            />
          </View>
          <SkeletonList count={4} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Animated.View
        style={{
          opacity: headerCollapse.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 1] }),
          transform: [
            {
              translateY: scrollY.interpolate({ inputRange: [0, 80], outputRange: [0, -10], extrapolate: "clamp" }),
            },
          ],
        }}
      >
        <WatchlistHeader
          mode={selectionMode ? "selection" : "normal"}
          selectedCount={selectedIds.size}
          watchlistLength={watchlist.length}
          filteredCount={filteredWatchlist.length}
          isRefreshingAny={isRefreshingAny}
          checking={checking}
          checkProgress={checkProgress}
          onAnalysis={() => router.push("/distributor-analysis")}
          onRefresh={handleRefreshAll}
          onCheckNow={handleCheckNow}
          onAdd={() => router.push("/search")}
          onImport={handleImportCsv}
          onBulkDelete={handleBulkDelete}
          onBulkTag={() => setBulkTagVisible(true)}
          onExitSelection={exitSelection}
          onShare={handleShareWatchlist}
        />
      </Animated.View>

                                          <SectionList
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={true}
        scrollEventThrottle={16}
        // QA round 8: scroll gestures were dead on device with
        // removeClippedSubviews enabled on Android.
        removeClippedSubviews={false}
        sections={sectionData}
        keyExtractor={(item: Product & { _sectionKey?: string }) => `${item.id}-${item._sectionKey ?? ''}`}
        extraData={groupMode}
        initialNumToRender={8}
        windowSize={7}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 24,
          flexGrow: 1,
        }}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshingAny}
            onRefresh={() => void refreshAll()}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
            titleColor={colors.muted}
          />
        }
        ListHeaderComponent={
          <WatchlistListHeader
            watchlistLength={watchlist.length}
            summary={summary}
            displayCurrency={displayCurrency}
            statusFilter={statusFilter}
            onStatusToggle={setStatusFilter}
            onViewStats={() => router.push("/stats")}
            onPlanOrder={() => router.push("/build-order")}
            onSourcing={() => router.push("/sourcing")}
            query={query}
            onQueryChange={setQuery}
            checking={checking}
            checkProgress={checkProgress}
            sortMode={sortMode}
            groupMode={groupMode}
            sortMenuOpen={sortMenuOpen}
            onSortModeChange={(mode) => {
              setSortMode(mode);
              setSortMenuOpen(false);
              void persistViewPrefs(mode, groupModeRef.current);
            }}
            onGroupModeChange={(mode) => {
              setGroupMode(mode);
              void persistViewPrefs(sortModeRef.current, mode);
            }}
            onSortMenuToggle={() => setSortMenuOpen((v) => !v)}
            filtersExpanded={filtersExpanded}
            onToggleFilters={() => {
              if (Platform.OS !== "web")
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFiltersManual((v) => !(v ?? activeFilterCount > 0));
            }}
            activeFilterCount={activeFilterCount}
            offline={connection.status === "offline"}
            queuedCount={queuedCount}
            filterPanel={
              <WatchlistFilterPanel
                visible={filtersExpanded && watchlist.length > 0}
                regions={regions}
                regionFilter={regionFilter}
                onRegionChange={setRegionFilter}
                inStockOnly={inStockOnly}
                onInStockOnlyChange={setInStockOnly}
                showAcquired={showAcquired}
                onShowAcquiredChange={setShowAcquired}
                displayCurrency={displayCurrency}
                priceMinInput={priceMinInput}
                priceMaxInput={priceMaxInput}
                onPriceMinChange={setPriceMinInput}
                onPriceMaxChange={setPriceMaxInput}
                onClearPrice={() => {
                  setPriceRange(undefined);
                  setPriceMinInput("");
                  setPriceMaxInput("");
                }}
                priceFilterActive={
                  !!priceRange || priceMinInput !== "" || priceMaxInput !== ""
                }
                tagDefinitions={tagDefinitions}
                selectedTagIds={validSelectedTagIds}
                tagMatchMode={tagMatchMode}
                tagCounts={tagCounts}
                onToggleTag={toggleTagFilter}
                onChangeTagMode={setTagMatchMode}
                onClearTags={() => setSelectedTagIds([])}
                onManageTags={() => setManageVisible(true)}
                activeFilterCount={activeFilterCount}
                onClearAll={clearAllFilters}
              />
            }
          />
        }
        ListEmptyComponent={
          <EmptyState
            query={query}
            statusFilter={statusFilter}
            regionFilter={regionFilter}
            selectedTagIds={validSelectedTagIds}
            inStockOnly={inStockOnly}
            priceRange={priceRange}
            allAcquired={watchlist.length > 0 && watchlist.every(isAcquired)}
            onClearFilters={clearAllFilters}
            onAddProduct={() => router.push("/search")}
          />
        }
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
      />
      <TagPickerSheet
        visible={!!pickerProduct}
        product={pickerProduct}
        onClose={() => setPickerProduct(null)}
        onChanged={() => {
          void reload();
          void loadData();
        }}
      />
      <TagManageSheet
        visible={manageVisible}
        onClose={() => setManageVisible(false)}
        onChanged={() => {
          void reload();
          void loadData();
        }}
      />
      <BulkTagSheet
        visible={bulkTagVisible}
        productIds={Array.from(selectedIds)}
        tagDefinitions={tagDefinitions}
        onClose={() => setBulkTagVisible(false)}
        onChanged={handleBulkTagChanged}
      />
      {undoProduct && (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16 + insets.bottom,
            backgroundColor: colors.foreground,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderWidth: 1,
            borderColor: colors.border + "33",
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 6,
          }}
        >
          <Text
            style={{ color: colors.background, fontSize: 13, flex: 1 }}
            numberOfLines={1}
          >
            Removed {undoProduct.name}
          </Text>
          <TouchableOpacity activeOpacity={0.7} onPress={handleUndo} accessibilityLabel="Undo remove" accessibilityRole="button">
            <Text
              style={{
                color: colors.primary,
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              Undo
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <PaywallScreen
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />
    </ScreenContainer>
  );
}
