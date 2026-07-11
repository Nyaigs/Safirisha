import { create } from "zustand";
import { apiFetch } from "../lib/api";
import { connectSocket } from "../lib/socket";

export type AdminDashboardStats = {
  totalOrders: number;
  activeTrips: number;
  deliveredTrips: number;
  cancelledTrips: number;
  pendingOrders: number;
  pendingDrivers: number;
  approvedDrivers: number;
  rejectedDrivers: number;
  onlineDrivers: number;
  busyDrivers: number;
  activeDrivers: number;
  totalUsers: number;
  totalCustomers: number;
  totalDrivers: number;
  totalAdmins: number;
  activeUsers: number;
  suspendedUsers: number;
  deliveredRevenue: number;
};

export type RecentOrder = {
  id: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  vehicleType?: string;
  loadSize?: string;
  estimatedPrice?: number;
  status?: string;
  customer?: { fullName?: string };
  assignedDriver?: { user?: { fullName?: string } } | null;
};

const FALLBACK_STATS: AdminDashboardStats = {
  totalOrders: 0,
  activeTrips: 0,
  deliveredTrips: 0,
  cancelledTrips: 0,
  pendingOrders: 0,
  pendingDrivers: 0,
  approvedDrivers: 0,
  rejectedDrivers: 0,
  onlineDrivers: 0,
  busyDrivers: 0,
  activeDrivers: 0,
  totalUsers: 0,
  totalCustomers: 0,
  totalDrivers: 0,
  totalAdmins: 0,
  activeUsers: 0,
  suspendedUsers: 0,
  deliveredRevenue: 0,
};

type AdminState = {
  stats: AdminDashboardStats;
  recentOrders: RecentOrder[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;

  fetchDashboard: () => Promise<void>;
  setRefreshing: (value: boolean) => void;
  reset: () => void;
};

export const useAdminStore = create<AdminState>()((set, get) => ({
  stats: FALLBACK_STATS,
  recentOrders: [],
  loading: true,
  refreshing: false,
  error: null,

  fetchDashboard: async () => {
    try {
      set({ error: null });

      const res = await apiFetch("/admin/dashboard");
      const s = res?.stats ?? {};

      set({
        stats: {
          totalOrders: s.totalOrders ?? 0,
          activeTrips: s.activeTrips ?? 0,
          deliveredTrips: s.deliveredTrips ?? 0,
          cancelledTrips: s.cancelledTrips ?? 0,
          pendingOrders: s.pendingOrders ?? 0,
          pendingDrivers: s.pendingDrivers ?? 0,
          approvedDrivers: s.approvedDrivers ?? 0,
          rejectedDrivers: s.rejectedDrivers ?? 0,
          onlineDrivers: s.onlineDrivers ?? 0,
          busyDrivers: s.busyDrivers ?? 0,
          activeDrivers: s.activeDrivers ?? 0,
          totalUsers: s.totalUsers ?? 0,
          totalCustomers: s.totalCustomers ?? 0,
          totalDrivers: s.totalDrivers ?? 0,
          totalAdmins: s.totalAdmins ?? 0,
          activeUsers: s.activeUsers ?? 0,
          suspendedUsers: s.suspendedUsers ?? 0,
          deliveredRevenue: s.deliveredRevenue ?? 0,
        },
        recentOrders: Array.isArray(res?.recentOrders)
          ? res.recentOrders
          : [],
        loading: false,
        refreshing: false,
      });
    } catch (error) {
      set({
        stats: FALLBACK_STATS,
        recentOrders: [],
        loading: false,
        refreshing: false,
        error: "Failed to load dashboard data",
      });
    }
  },

  setRefreshing: (value) => set({ refreshing: value }),

  reset: () =>
    set({
      stats: FALLBACK_STATS,
      recentOrders: [],
      loading: true,
      refreshing: false,
      error: null,
    }),
}));

let adminSocketCleanup: (() => void) | null = null;

export function subscribeAdminStats() {
  if (adminSocketCleanup) return;

  const socket = connectSocket();
  const handler = () => {
    useAdminStore.getState().fetchDashboard();
  };

  socket.on("admin_stats_updated", handler);

  adminSocketCleanup = () => {
    socket.off("admin_stats_updated", handler);
    adminSocketCleanup = null;
  };
}

export function unsubscribeAdminStats() {
  adminSocketCleanup?.();
}
