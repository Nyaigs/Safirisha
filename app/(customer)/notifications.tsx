import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { design } from "../../constants/design";
import { useNotificationsStore } from "../../store/notifications";
import type { AppNotification } from "../../types/notification";

const ICON_BY_TYPE: Record<string, keyof typeof Ionicons.glyphMap> = {
  trip_accepted: "checkmark-circle",
  driver_en_route: "car",
  driver_arrived_pickup: "location",
  pickup_confirmed: "cube",
  in_transit: "navigate",
  arrived_dropoff: "location",
  delivery_confirmed: "checkmark-done",
  trip_completed: "star",
  trip_cancelled: "close-circle",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const items = useNotificationsStore((s) => s.items);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const isLoading = useNotificationsStore((s) => s.isLoading);
  const error = useNotificationsStore((s) => s.error);
  const fetchNotifications = useNotificationsStore((s) => s.fetchNotifications);
  const markAsRead = useNotificationsStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationsStore((s) => s.markAllAsRead);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications]),
  );

  const handlePress = (item: AppNotification) => {
    if (!item.isRead) markAsRead(item.id);
    if (item.tripId) {
      router.push({
        pathname: "/(customer)/live-trip",
        params: { tripId: item.tripId },
      });
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={design.colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {isLoading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={design.colors.brand} />
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Could not load</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name="notifications-off-outline"
            size={40}
            color={design.colors.muted}
          />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>
            Trip updates will appear here as your deliveries progress.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const icon = ICON_BY_TYPE[item.type] ?? "notifications";
            return (
              <TouchableOpacity
                style={[styles.row, !item.isRead && styles.rowUnread]}
                onPress={() => handlePress(item)}
                activeOpacity={0.7}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={icon} size={20} color={design.colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
                  </View>
                  <Text style={styles.rowMessage} numberOfLines={2}>
                    {item.message}
                  </Text>
                </View>
                {!item.isRead && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F5F5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: design.spacing.md,
    paddingVertical: design.spacing.sm,
    marginBottom: design.spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...design.typography.title, color: design.colors.ink },
  markAllBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  markAllText: { ...design.typography.caption, color: design.colors.brand, fontWeight: "600" },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: design.spacing.lg,
    gap: design.spacing.sm,
  },
  emptyTitle: { ...design.typography.heading, color: design.colors.ink, marginTop: design.spacing.sm },
  emptyText: { ...design.typography.body, color: design.colors.muted, textAlign: "center" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: design.spacing.sm,
    paddingHorizontal: design.spacing.md,
    paddingVertical: 14,
    backgroundColor: design.colors.surface,
  },
  rowUnread: { backgroundColor: design.colors.brandSoft },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: design.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...design.shadow,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  rowTitle: { ...design.typography.label, color: design.colors.ink, flex: 1, marginRight: 8 },
  rowTime: { ...design.typography.caption, color: design.colors.muted },
  rowMessage: { ...design.typography.caption, color: design.colors.muted },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: design.colors.brand,
    marginLeft: design.spacing.xs,
  },
  separator: { height: 1, backgroundColor: design.colors.border, marginLeft: 64 },
});
