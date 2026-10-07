import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import {
  healthColor,
  healthIcon,
} from "@/lib/notification-center-helpers";
import { formatRelativeTime } from "@/lib/relative-time";
import { notificationRouteFor } from "@/lib/notification-routing";
import { showAlert } from "@/lib/alert";
import { syncServerNotifications } from "@/lib/server-notifications";
import {
  getNotificationHistory,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToStorageChanges,
} from "@/lib/storage";
import type { NotificationHistoryEntry } from "@/lib/types";
import { SkeletonList } from "@/components/ui/skeleton";

type HistoryType = NotificationHistoryEntry["type"];
type TypeIconName =
  | "dollarsign.circle.fill"
  | "chart.line.uptrend.xyaxis"
  | "checkmark.circle.fill"
  | "clock.fill"
  | "chart.bar.fill"
  | "exclamationmark.triangle.fill";

const TYPE_ICONS: Record<HistoryType, TypeIconName> = {
  price_drop: "dollarsign.circle.fill",
  price_rise: "chart.line.uptrend.xyaxis",
  restock: "checkmark.circle.fill",
  reminder: "clock.fill",
  health: "exclamationmark.triangle.fill",
  digest: "chart.bar.fill",
  suspicious_price: "exclamationmark.triangle.fill",
};

export function NotificationCenter({
  onUnreadChange,
}: {
  onUnreadChange?: (count: number) => void;
}) {
  const colors = useColors();
  const router = useRouter();
  const [history, setHistory] = useState<NotificationHistoryEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const applyUnread = useCallback(
    (next: number) => {
      setUnreadCount(next);
      onUnreadChange?.(next);
    },
    [onUnreadChange],
  );

  // Functional decrement: two quick taps used to read the same stale
  // `unreadCount` closure and under-count the badge by one.
  const decrementUnread = useCallback(() => {
    setUnreadCount((prev) => {
      const next = Math.max(0, prev - 1);
      onUnreadChange?.(next);
      return next;
    });
  }, [onUnreadChange]);

  const loadGen = useRef(0);

  const load = useCallback(async () => {
    // Generation guard: a focus load and a pull-to-refresh load can overlap, and
    // the older one resolving last would overwrite the newer list/unread count.
    const gen = ++loadGen.current;
    try {
      const [list, unread] = await Promise.all([
        getNotificationHistory(),
        getUnreadNotificationCount(),
      ]);
      if (gen !== loadGen.current) return;
      setHistory(list);
      applyUnread(unread);
    } catch {
      // A storage failure must still clear the skeleton, or the tab hangs
      // forever with no error and no way to recover.
    } finally {
      if (gen === loadGen.current) setLoading(false);
    }
  }, [applyUnread]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Local mutations (a notification marked read, an alert reconciled) must
  // refresh the visible center, not just the tab badge.
  useEffect(() => subscribeToStorageChanges(() => { void load(); }), [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncServerNotifications();
    await load();
    setRefreshing(false);
  }, [load]);

  const handleOpen = useCallback(
    async (item: NotificationHistoryEntry) => {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (!item.read) {
        try {
          await markNotificationRead(item.id);
        } catch {
          // A storage failure must not reject unhandled or mark it read in the
          // UI when the write didn't land.
          showAlert("Couldn't update", "We couldn't update that notification. Please try again.");
          return;
        }
        decrementUnread();
        setHistory((prev) =>
          prev.map((e) => (e.id === item.id ? { ...e, read: true } : e)),
        );
      }
      // Route via the shared helper so digest (productId: "") and health
      // events land on the right screen instead of /product/undefined.
      const route = notificationRouteFor({
        productId: item.productId || undefined,
        type: item.type,
      });
      if (route) router.push(route as never);
    },
    [router, decrementUnread],
  );

  const handleMarkAll = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await markAllNotificationsRead();
    } catch {
      // A storage failure must not reject unhandled or clear the badge as if
      // the write succeeded.
      showAlert("Couldn't update", "We couldn't mark notifications as read. Please try again.");
      return;
    }
    applyUnread(0);
    setHistory((prev) => prev.map((e) => ({ ...e, read: true })));
  }, [applyUnread]);

  return (
    <FlatList
      data={history}
      keyExtractor={(item) => item.id}
      initialNumToRender={10}
      windowSize={5}
      maxToRenderPerBatch={8}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: 24,
        flexGrow: 1,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        history.length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <Text
              style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}
            >
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </Text>
            {unreadCount > 0 && (
              <TouchableOpacity activeOpacity={0.7} onPress={handleMarkAll} style={{ padding: 4 }} accessibilityLabel="Mark all as read" accessibilityRole="button">
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  Mark all read
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null
      }
      ListEmptyComponent={
        loading ? (
          <SkeletonList count={3} />
        ) : (
          <View style={{ alignItems: "center", paddingHorizontal: 16, marginTop: 40 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.primary + "14",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.primary + "22",
              }}
            >
              <IconSymbol name="bell.fill" size={26} color={colors.primary} />
            </View>
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 16, marginTop: 14 }}>
              No notifications yet
            </Text>
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 6, lineHeight: 20 }}>
              Price alerts and restock updates will appear here.
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => (
        <TouchableOpacity activeOpacity={0.7}
          onPress={() => handleOpen(item)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginBottom: 10,
          }}
          accessibilityLabel={`${item.title}. ${item.body}`}
          accessibilityRole="button"
        >
          <IconSymbol
            name={
              item.type === "health"
                ? healthIcon(item.healthStatus)
                : TYPE_ICONS[item.type]
            }
            size={22}
            color={
              item.type === "health"
                ? colors[healthColor(item.healthStatus)]
                : item.type === "reminder"
                  ? colors.warning
                  : colors.success
            }
          />
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "700",
                fontSize: 14,
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.title}
            </Text>
            <Text
              style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {item.body}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
              {formatRelativeTime(item.createdAt)}
            </Text>
          </View>
          {!item.read && (
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: colors.primary,
                borderWidth: 1.5,
                borderColor: colors.surface,
                position: "absolute",
                top: 12,
                right: 12,
              }}
            />
          )}
        </TouchableOpacity>
      )}
    />
  );
}
