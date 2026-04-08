import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiFetch } from "../../lib/api";
import { connectSocket, joinTripRoom, leaveTripRoom } from "../../lib/socket";

type TripStatus =
  | "SEARCHING"
  | "ACCEPTED"
  | "DRIVER_EN_ROUTE"
  | "ARRIVED_PICKUP"
  | "PICKUP_CONFIRMED"
  | "IN_TRANSIT"
  | "ARRIVED_DROPOFF"
  | "DELIVERY_CONFIRMED"
  | "DELIVERED"
  | "CANCELLED";

type DriverAvailability = "OFFLINE" | "ONLINE" | "BUSY" | string;

type TripDetails = {
  id: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  vehicleType: string;
  loadDescription?: string | null;
  loadSize: string;
  specialNotes?: string | null;
  estimatedPrice: number;
  distanceKm: number;
  status: TripStatus;
  createdAt: string;
  customer: {
    fullName: string;
    email: string;
    phone: string;
    username?: string | null;
  };
  assignedDriver?: {
    plateNumber: string;
    vehicleType: string;
    availability?: string;
    currentLat?: number | null;
    currentLng?: number | null;
    currentHeading?: number | null;
    currentSpeed?: number | null;
    lastLocationAt?: string | null;
    user: {
      fullName: string;
      email: string;
      phone: string;
      username?: string | null;
      isActive?: boolean;
    };
  } | null;
};

type TrackingInfo = {
  currentLat?: number | null;
  currentLng?: number | null;
  currentHeading?: number | null;
  currentSpeed?: number | null;
  lastLocationAt?: string | null;
  availability?: DriverAvailability;
} | null;

type TripAcceptedEvent = {
  tripId: string;
  status: TripStatus;
  driver: {
    id: string;
    name: string;
    phone: string;
    plateNumber: string;
    vehicleType: string;
  } | null;
};

type TripStatusUpdatedEvent = {
  tripId: string;
  status: TripStatus;
};

type DriverLocationUpdatedEvent = {
  tripId?: string;
  driverId?: string;
  id?: string;
  lat?: number;
  lng?: number;
  currentLat?: number | null;
  currentLng?: number | null;
  heading?: number | null;
  speed?: number | null;
  updatedAt?: string;
  availability?: string | null;
};

function formatStatus(status: TripStatus) {
  return status.replace(/_/g, " ");
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCoord(value?: number | null) {
  if (typeof value !== "number") return "Not available";
  return value.toFixed(6);
}

function formatSpeed(value?: number | null) {
  if (typeof value !== "number") return "Not available";
  return `${value.toFixed(1)} km/h`;
}

function formatMoney(value?: number | null) {
  const amount = Number(value ?? 0);
  return `KES ${amount.toLocaleString()}`;
}

function formatVehicleType(value?: string | null) {
  if (!value) return "Unknown vehicle";
  return value.replace(/_/g, " ");
}

function getInitials(name?: string | null) {
  if (!name) return "NA";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || "").join("") || "NA";
}

function getStatusColors(status: TripStatus) {
  switch (status) {
    case "DELIVERED":
      return {
        bg: "#DCFCE7",
        text: "#166534",
        soft: "#F0FDF4",
        line: "#22C55E",
      };
    case "CANCELLED":
      return {
        bg: "#FEE2E2",
        text: "#B91C1C",
        soft: "#FEF2F2",
        line: "#EF4444",
      };
    case "SEARCHING":
      return {
        bg: "#FEF3C7",
        text: "#B45309",
        soft: "#FFFBEB",
        line: "#F59E0B",
      };
    case "ACCEPTED":
    case "DRIVER_EN_ROUTE":
    case "ARRIVED_PICKUP":
    case "PICKUP_CONFIRMED":
    case "IN_TRANSIT":
    case "ARRIVED_DROPOFF":
    case "DELIVERY_CONFIRMED":
      return {
        bg: "#E0E7FF",
        text: "#4338CA",
        soft: "#EEF2FF",
        line: "#4F46E5",
      };
    default:
      return {
        bg: "#E5E7EB",
        text: "#111827",
        soft: "#F8FAFC",
        line: "#94A3B8",
      };
  }
}

function getTrackingStateColors(availability?: string) {
  switch (availability) {
    case "BUSY":
      return { bg: "#DCFCE7", text: "#166534", soft: "#F0FDF4" };
    case "ONLINE":
      return { bg: "#E0F2FE", text: "#0369A1", soft: "#F0F9FF" };
    case "OFFLINE":
      return { bg: "#F3F4F6", text: "#374151", soft: "#F8FAFC" };
    default:
      return { bg: "#E5E7EB", text: "#111827", soft: "#F8FAFC" };
  }
}

function getJourneyStage(status: TripStatus) {
  switch (status) {
    case "SEARCHING":
      return "Waiting for driver assignment";
    case "ACCEPTED":
      return "Driver assigned";
    case "DRIVER_EN_ROUTE":
      return "Driver heading to pickup";
    case "ARRIVED_PICKUP":
      return "Driver arrived at pickup";
    case "PICKUP_CONFIRMED":
      return "Pickup confirmed";
    case "IN_TRANSIT":
      return "Goods in transit";
    case "ARRIVED_DROPOFF":
      return "Driver arrived at drop-off";
    case "DELIVERY_CONFIRMED":
      return "Delivery confirmed";
    case "DELIVERED":
      return "Trip completed";
    case "CANCELLED":
      return "Trip cancelled";
    default:
      return "Unknown";
  }
}

function getProgressValue(status: TripStatus) {
  switch (status) {
    case "SEARCHING":
      return 8;
    case "ACCEPTED":
      return 20;
    case "DRIVER_EN_ROUTE":
      return 35;
    case "ARRIVED_PICKUP":
      return 50;
    case "PICKUP_CONFIRMED":
      return 62;
    case "IN_TRANSIT":
      return 78;
    case "ARRIVED_DROPOFF":
      return 90;
    case "DELIVERY_CONFIRMED":
    case "DELIVERED":
      return 100;
    case "CANCELLED":
      return 100;
    default:
      return 0;
  }
}

function getTimelineSteps(status: TripStatus) {
  const allSteps = [
    { key: "SEARCHING", label: "Searching" },
    { key: "ACCEPTED", label: "Accepted" },
    { key: "DRIVER_EN_ROUTE", label: "En Route" },
    { key: "ARRIVED_PICKUP", label: "At Pickup" },
    { key: "PICKUP_CONFIRMED", label: "Picked Up" },
    { key: "IN_TRANSIT", label: "In Transit" },
    { key: "ARRIVED_DROPOFF", label: "At Drop-off" },
    { key: "DELIVERY_CONFIRMED", label: "Confirmed" },
    { key: "DELIVERED", label: "Delivered" },
  ] as const;

  if (status === "CANCELLED") {
    return allSteps.map((step, index) => ({
      ...step,
      done: index <= 1,
      active: false,
      cancelled: step.key === "DELIVERED",
    }));
  }

  const currentIndex = allSteps.findIndex((step) => step.key === status);

  return allSteps.map((step, index) => ({
    ...step,
    done: index < currentIndex,
    active: index === currentIndex,
    cancelled: false,
  }));
}

export default function AdminTripDetailsScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();

  const [trip, setTrip] = useState<TripDetails | null>(null);
  const [tracking, setTracking] = useState<TrackingInfo>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isLiveTrip = useMemo(() => {
    if (!trip) return false;

    return [
      "ACCEPTED",
      "DRIVER_EN_ROUTE",
      "ARRIVED_PICKUP",
      "PICKUP_CONFIRMED",
      "IN_TRANSIT",
      "ARRIVED_DROPOFF",
      "DELIVERY_CONFIRMED",
    ].includes(trip.status);
  }, [trip]);

  const fetchTrip = useCallback(async () => {
    if (!tripId) return;

    const data = await apiFetch(`/admin/trips/${tripId}`);
    setTrip(data?.trip || null);
    setTracking(data?.tracking || null);
  }, [tripId]);

  useEffect(() => {
    if (!tripId) {
      setLoading(false);
      return;
    }

    fetchTrip()
      .catch((error: any) => {
        Alert.alert("Load failed", error?.message || "Could not load trip");
      })
      .finally(() => setLoading(false));
  }, [tripId, fetchTrip]);

  useEffect(() => {
    if (!tripId) return;

    const socket = connectSocket();
    joinTripRoom(tripId);

    const handleTripAccepted = (payload: TripAcceptedEvent) => {
      if (payload.tripId !== tripId) return;

      setTrip((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          status: payload.status,
          assignedDriver: payload.driver
            ? {
                ...prev.assignedDriver,
                plateNumber: payload.driver.plateNumber,
                vehicleType: payload.driver.vehicleType,
                user: {
                  fullName: payload.driver.name,
                  email: "",
                  phone: payload.driver.phone,
                  username: null,
                  isActive: true,
                },
              }
            : prev.assignedDriver,
        };
      });

      setTracking((prev) => ({
        ...(prev || {}),
        availability: "BUSY",
      }));
    };

    const handleTripStatusUpdated = (payload: TripStatusUpdatedEvent) => {
      if (payload.tripId !== tripId) return;

      setTrip((prev) => {
        if (!prev) return prev;
        return { ...prev, status: payload.status };
      });
    };

    const handleDriverLocationUpdated = (
      payload: DriverLocationUpdatedEvent,
    ) => {
      if (payload.tripId && payload.tripId !== tripId) return;

      const lat =
        typeof payload.lat === "number"
          ? payload.lat
          : typeof payload.currentLat === "number"
            ? payload.currentLat
            : null;

      const lng =
        typeof payload.lng === "number"
          ? payload.lng
          : typeof payload.currentLng === "number"
            ? payload.currentLng
            : null;

      if (lat == null || lng == null) return;

      setTracking((prev) => ({
        ...(prev || {}),
        currentLat: lat,
        currentLng: lng,
        currentHeading:
          typeof payload.heading === "number" ? payload.heading : null,
        currentSpeed: typeof payload.speed === "number" ? payload.speed : null,
        lastLocationAt: payload.updatedAt || new Date().toISOString(),
        availability: payload.availability || "BUSY",
      }));
    };

    socket.on("trip_accepted", handleTripAccepted);
    socket.on("trip_status_updated", handleTripStatusUpdated);
    socket.on("driver_location_updated", handleDriverLocationUpdated);
    socket.on("admin_stats_updated", fetchTrip);

    return () => {
      socket.off("trip_accepted", handleTripAccepted);
      socket.off("trip_status_updated", handleTripStatusUpdated);
      socket.off("driver_location_updated", handleDriverLocationUpdated);
      socket.off("admin_stats_updated", fetchTrip);
      leaveTripRoom(tripId);
    };
  }, [tripId, fetchTrip]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchTrip();
    } catch (error: any) {
      Alert.alert("Refresh failed", error?.message || "Could not refresh trip");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0f172a" size="large" />
        <Text style={styles.loadingText}>Loading trip details...</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Trip not found</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const statusColors = getStatusColors(trip.status);
  const trackingColors = getTrackingStateColors(tracking?.availability);
  const progressValue = getProgressValue(trip.status);
  const timelineSteps = getTimelineSteps(trip.status);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Pressable style={styles.backIconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Trip Details</Text>
          <Text style={styles.headerSubtitle}>Premium admin trip control</Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <View style={[styles.heroCard, { backgroundColor: statusColors.soft }]}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIconWrap}>
            <MaterialCommunityIcons
              name="truck-delivery-outline"
              size={24}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.heroMain}>
            <Text style={styles.cardTitle}>
              {formatVehicleType(trip.vehicleType)}
            </Text>
            <Text style={styles.timeText}>{formatDate(trip.createdAt)}</Text>
            <Text style={styles.tripIdText}>Trip ID • {trip.id}</Text>
          </View>
        </View>

        <View style={styles.badgesRow}>
          <Text
            style={[
              styles.badge,
              { backgroundColor: statusColors.bg, color: statusColors.text },
            ]}
          >
            {formatStatus(trip.status)}
          </Text>

          {tracking?.availability ? (
            <Text
              style={[
                styles.badge,
                {
                  backgroundColor: trackingColors.bg,
                  color: trackingColors.text,
                },
              ]}
            >
              Driver {tracking.availability}
            </Text>
          ) : null}

          {isLiveTrip ? (
            <Text style={[styles.badge, styles.liveBadge]}>LIVE</Text>
          ) : null}
        </View>

        <Text style={styles.stageText}>
          Journey Stage: {getJourneyStage(trip.status)}
        </Text>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressValue}%`,
                backgroundColor: statusColors.line,
              },
            ]}
          />
        </View>

        <View style={styles.heroStatsRow}>
          <HeroMiniStat
            label="Distance"
            value={`${trip.distanceKm} km`}
            icon="navigate-outline"
          />
          <HeroMiniStat
            label="Price"
            value={formatMoney(trip.estimatedPrice)}
            icon="cash-outline"
          />
          <HeroMiniStat
            label="Load Size"
            value={trip.loadSize}
            icon="cube-outline"
          />
        </View>
      </View>

      <SectionCard title="Trip Timeline" icon="git-branch-outline">
        {timelineSteps.map((step, index) => (
          <View key={step.key} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View
                style={[
                  styles.timelineDot,
                  step.done && styles.timelineDotDone,
                  step.active && styles.timelineDotActive,
                ]}
              />
              {index !== timelineSteps.length - 1 ? (
                <View
                  style={[
                    styles.timelineLine,
                    (step.done || step.active) && styles.timelineLineDone,
                  ]}
                />
              ) : null}
            </View>

            <View style={styles.timelineContent}>
              <Text
                style={[
                  styles.timelineLabel,
                  (step.done || step.active) && styles.timelineLabelActive,
                ]}
              >
                {step.label}
              </Text>
            </View>
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Route" icon="location-outline">
        <RouteBlock
          title="Pickup Address"
          address={trip.pickupAddress}
          lat={trip.pickupLat}
          lng={trip.pickupLng}
          tone="pickup"
        />

        <View style={styles.routeDividerWrap}>
          <View style={styles.routeDivider} />
          <MaterialCommunityIcons
            name="arrow-down-circle-outline"
            size={20}
            color="#94a3b8"
          />
          <View style={styles.routeDivider} />
        </View>

        <RouteBlock
          title="Drop-off Address"
          address={trip.dropoffAddress}
          lat={trip.dropoffLat}
          lng={trip.dropoffLng}
          tone="dropoff"
        />
      </SectionCard>

      <SectionCard title="Trip Info" icon="document-text-outline">
        <View style={styles.infoGrid}>
          <InfoItem label="Load Size" value={trip.loadSize} />
          <InfoItem label="Distance" value={`${trip.distanceKm} km`} />
          <InfoItem
            label="Estimated Price"
            value={formatMoney(trip.estimatedPrice)}
          />
          <InfoItem label="Status" value={formatStatus(trip.status)} />
        </View>

        <DetailBlock
          label="Load Description"
          value={trip.loadDescription || "Not provided"}
        />
        <DetailBlock
          label="Special Notes"
          value={trip.specialNotes || "None"}
        />
      </SectionCard>

      <SectionCard title="Customer" icon="person-outline">
        <ProfileBlock
          title={trip.customer.fullName}
          subtitle={trip.customer.email || "No email available"}
          line2={trip.customer.phone}
          line3={`@${trip.customer.username || "no_username"}`}
          initials={getInitials(trip.customer.fullName)}
        />
      </SectionCard>

      <SectionCard title="Assigned Driver" icon="car-outline">
        {trip.assignedDriver ? (
          <>
            <ProfileBlock
              title={trip.assignedDriver.user.fullName}
              subtitle={trip.assignedDriver.user.email || "No email available"}
              line2={trip.assignedDriver.user.phone}
              line3={`@${trip.assignedDriver.user.username || "no_username"}`}
              initials={getInitials(trip.assignedDriver.user.fullName)}
            />

            <View style={styles.driverMetaRow}>
              <PillInfo
                icon="car-outline"
                label={formatVehicleType(trip.assignedDriver.vehicleType)}
              />
              <PillInfo
                icon="card-outline"
                label={trip.assignedDriver.plateNumber}
              />
            </View>
          </>
        ) : (
          <EmptyInline text="No driver assigned yet." />
        )}
      </SectionCard>

      <SectionCard title="Live Tracking" icon="pulse-outline">
        {!trip.assignedDriver ? (
          <EmptyInline text="Tracking will appear once a driver is assigned." />
        ) : !tracking ? (
          <EmptyInline text="No tracking data yet." />
        ) : (
          <>
            <View style={styles.infoGrid}>
              <InfoItem
                label="Current Latitude"
                value={formatCoord(tracking.currentLat)}
              />
              <InfoItem
                label="Current Longitude"
                value={formatCoord(tracking.currentLng)}
              />
              <InfoItem
                label="Heading"
                value={
                  typeof tracking.currentHeading === "number"
                    ? `${Math.round(tracking.currentHeading)}°`
                    : "Not available"
                }
              />
              <InfoItem
                label="Speed"
                value={formatSpeed(tracking.currentSpeed)}
              />
            </View>

            <DetailBlock
              label="Last Location Update"
              value={formatDate(tracking.lastLocationAt || null)}
            />

            <Text style={styles.label}>Driver Availability</Text>
            <Text
              style={[
                styles.inlinePill,
                {
                  backgroundColor: trackingColors.bg,
                  color: trackingColors.text,
                },
              ]}
            >
              {tracking.availability || "UNKNOWN"}
            </Text>

            <View style={styles.liveHintBox}>
              <Ionicons name="radio-outline" size={16} color="#0f766e" />
              <Text style={styles.liveHint}>
                Live updates are being pushed through sockets and trip-room
                events.
              </Text>
            </View>
          </>
        )}
      </SectionCard>
    </ScrollView>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>
          <Ionicons name={icon} size={18} color="#0f172a" />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailBlock}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function HeroMiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.heroMiniStat}>
      <Ionicons name={icon} size={16} color="#334155" />
      <Text style={styles.heroMiniValue}>{value}</Text>
      <Text style={styles.heroMiniLabel}>{label}</Text>
    </View>
  );
}

function RouteBlock({
  title,
  address,
  lat,
  lng,
  tone,
}: {
  title: string;
  address: string;
  lat: number;
  lng: number;
  tone: "pickup" | "dropoff";
}) {
  const iconName =
    tone === "pickup" ? "radio-button-on-outline" : "location-outline";
  const iconColor = tone === "pickup" ? "#0369a1" : "#7c3aed";
  const iconBg = tone === "pickup" ? "#e0f2fe" : "#ede9fe";

  return (
    <View style={styles.routeBlock}>
      <View style={[styles.routeIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={18} color={iconColor} />
      </View>

      <View style={styles.routeTextWrap}>
        <Text style={styles.label}>{title}</Text>
        <Text style={styles.value}>{address}</Text>
        <Text style={styles.coordText}>
          Lat {formatCoord(lat)} • Lng {formatCoord(lng)}
        </Text>
      </View>
    </View>
  );
}

function ProfileBlock({
  title,
  subtitle,
  line2,
  line3,
  initials,
}: {
  title: string;
  subtitle: string;
  line2: string;
  line3: string;
  initials: string;
}) {
  return (
    <View style={styles.profileBlock}>
      <View style={styles.profileAvatar}>
        <Text style={styles.profileAvatarText}>{initials}</Text>
      </View>

      <View style={styles.profileTextWrap}>
        <Text style={styles.value}>{title}</Text>
        <Text style={styles.subValue}>{subtitle}</Text>
        <Text style={styles.subValue}>{line2}</Text>
        <Text style={styles.subValue}>{line3}</Text>
      </View>
    </View>
  );
}

function PillInfo({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.pillInfo}>
      <Ionicons name={icon} size={15} color="#0f172a" />
      <Text style={styles.pillInfoText}>{label}</Text>
    </View>
  );
}

function EmptyInline({ text }: { text: string }) {
  return (
    <View style={styles.emptyInline}>
      <Text style={styles.emptyInlineText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  content: {
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    color: "#64748b",
    fontWeight: "600",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  backBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  header: {
    backgroundColor: "#0b1220",
    paddingTop: 62,
    paddingHorizontal: 16,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#182235",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 42,
    height: 42,
  },

  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    marginHorizontal: 16,
    marginTop: 16,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  heroMain: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 4,
  },
  timeText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "700",
  },
  tripIdText: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4,
    fontWeight: "700",
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 2,
  },
  badge: {
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    marginRight: 8,
    marginTop: 8,
  },
  liveBadge: {
    backgroundColor: "#111827",
    color: "#FFFFFF",
  },
  stageText: {
    marginTop: 14,
    color: "#334155",
    fontWeight: "800",
  },
  progressTrack: {
    height: 10,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    marginTop: 14,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  heroStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  heroMiniStat: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    marginHorizontal: 4,
  },
  heroMiniValue: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
    marginTop: 6,
    textAlign: "center",
  },
  heroMiniLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "800",
    marginTop: 4,
    textAlign: "center",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },

  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  timelineRail: {
    alignItems: "center",
    marginRight: 12,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    borderWidth: 2,
    borderColor: "#CBD5E1",
  },
  timelineDotDone: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  timelineDotActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#0F172A",
  },
  timelineLine: {
    width: 2,
    height: 26,
    backgroundColor: "#E5E7EB",
    marginVertical: 4,
  },
  timelineLineDone: {
    backgroundColor: "#0F172A",
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 12,
  },
  timelineLabel: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 14,
    paddingTop: 0,
  },
  timelineLabelActive: {
    color: "#111827",
    fontWeight: "900",
  },

  label: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "800",
    marginBottom: 4,
  },
  value: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "800",
    lineHeight: 21,
  },
  subValue: {
    fontSize: 14,
    color: "#475569",
    marginTop: 5,
    lineHeight: 20,
  },
  coordText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 6,
    fontWeight: "700",
  },
  detailBlock: {
    marginTop: 12,
  },

  routeBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  routeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 8,
  },
  routeTextWrap: {
    flex: 1,
  },
  routeDividerWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
  },
  routeDivider: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },

  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  infoBox: {
    width: "48%",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "800",
    lineHeight: 20,
  },

  profileBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  profileAvatarText: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "900",
  },
  profileTextWrap: {
    flex: 1,
  },

  driverMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
  },
  pillInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
    marginTop: 8,
  },
  pillInfoText: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 12,
    marginLeft: 6,
  },

  inlinePill: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 4,
  },
  liveHintBox: {
    marginTop: 12,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#D1FAE5",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  liveHint: {
    flex: 1,
    color: "#0f766e",
    fontWeight: "700",
    lineHeight: 20,
    fontSize: 13,
    marginLeft: 8,
  },

  emptyInline: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 14,
  },
  emptyInlineText: {
    color: "#64748b",
    fontWeight: "700",
  },
});
