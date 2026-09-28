import { create } from "zustand";
import { apiFetch } from "../lib/api";
import type { AppNotification } from "../types/notification";

type NotificationsState = {
  items: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  reset: () => void;
};

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  fetchNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch("/notifications");
      const items: AppNotification[] = res?.items ?? [];
      const unreadCount: number = res?.unreadCount ?? 0;
      set({ items, unreadCount, isLoading: false });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.message ?? "Failed to load notifications",
      });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const res = await apiFetch("/notifications/unread-count");
      const unreadCount: number = res?.count ?? 0;
      set({ unreadCount });
    } catch (err) {
      // silent — bell badge is not critical
      console.log("fetchUnreadCount failed:", err);
    }
  },

  markAsRead: async (id: string) => {
    const previous = get().items;
    // optimistic
    set({
      items: previous.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      unreadCount: Math.max(0, get().unreadCount - 1),
    });
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "POST" });
    } catch (err) {
      // revert on failure
      set({ items: previous });
      console.log("markAsRead failed:", err);
    }
  },

  markAllAsRead: async () => {
    const previous = get().items;
    set({
      items: previous.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    });
    try {
      await apiFetch("/notifications/read-all", { method: "POST" });
    } catch (err) {
      set({ items: previous });
      console.log("markAllAsRead failed:", err);
    }
  },

  reset: () => set({ items: [], unreadCount: 0, error: null }),
}));
