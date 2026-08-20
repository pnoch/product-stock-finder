import { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
import { syncServerNotifications } from "@/lib/server-notifications";
import {
  getNotificationHistory,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/storage";
import type { NotificationHistoryEntry } from "@/lib/types";

type HistoryType = NotificationHistoryEntry["type"];
type TypeIconName =
  | "dollarsign.circle.fill"
  | "checkmark.circle.fill"
  | "clock.fill"
  | "exclamationmark.triangle.fill";

const TYPE_ICONS: Record<HistoryType, TypeIconName> = {
  price_drop: "dollarsign.circle.fill",
  restock: "checkmark.circle.fill",
  reminder: "clock.fill",
  health: "exclamationmark.triangle.fill",
};

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

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
      router.push(`/product/${item.productId}`);
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
              <TouchableOpacity onPress={handleMarkAll} style={{ padding: 4 }}>
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
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <Text
            style={{
              color: colors.muted,
              textAlign: "center",
              marginTop: 40,
            }}
          >
            No notifications yet.
          </Text>
        )
      }
      renderItem={({ item }) => (
        <TouchableOpacity
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
        >
          <IconSymbol
            name={TYPE_ICONS[item.type]}
            size={22}
            color={item.type === "reminder" ? colors.warning : colors.success}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.foreground,
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              {item.title}
            </Text>
            <Text
              style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}
              numberOfLines={2}
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
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.primary,
              }}
            />
          )}
        </TouchableOpacity>
      )}
    />
  );
}
