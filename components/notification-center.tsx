import { useCallback, useState } from "react";
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
import { syncServerNotifications } from "@/lib/server-notifications";
import {
  getNotificationHistory,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
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

  const load = useCallback(async () => {
    const [list, unread] = await Promise.all([
      getNotificationHistory(),
      getUnreadNotificationCount(),
    ]);
    setHistory(list);
    applyUnread(unread);
    setLoading(false);
  }, [applyUnread]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
        await markNotificationRead(item.id);
        applyUnread(Math.max(0, unreadCount - 1));
        setHistory((prev) =>
          prev.map((e) => (e.id === item.id ? { ...e, read: true } : e)),
        );
      }
      if (item.type === "health") {
        router.push(`/health/${item.distributorId}`);
      } else {
        router.push(`/product/${item.productId}`);
      }
    },
    [router, unreadCount, applyUnread],
  );

  const handleMarkAll = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await markAllNotificationsRead();
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
