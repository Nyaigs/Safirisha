import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

export type JobPingDetails = {
  id: string;
  estimatedPrice?: number | null;
  distanceToPickupKm: number;
  pickupAddress?: string | null;
  loadDescription?: string | null;
  loadSize?: string | null;
};

type Props = {
  job: JobPingDetails | null;
  accepting: boolean;
  onAccept: (jobId: string) => void;
  onDecline: (jobId: string) => void;
};

const DURATION_SECONDS = 30;
const RING_SIZE = 112;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function JobPing({ job, accepting, onAccept, onDecline }: Props) {
  const { height } = useWindowDimensions();
  const [secondsLeft, setSecondsLeft] = useState(DURATION_SECONDS);
  const jobId = job?.id;
  const declineRef = useRef(onDecline);

  useEffect(() => {
    declineRef.current = onDecline;
  }, [onDecline]);

  useEffect(() => {
    if (!jobId) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    let remaining = DURATION_SECONDS;
    const timer = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(timer);
        declineRef.current(jobId);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [jobId]);

  const ringOffset = useMemo(
    () => RING_CIRCUMFERENCE * (1 - secondsLeft / DURATION_SECONDS),
    [secondsLeft],
  );

  if (!job) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onDecline(job.id)}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.header}>
          <View style={styles.arrivalLabel}>
            <Ionicons name="notifications" size={17} color="#713f12" />
            <Text style={styles.arrivalText}>NEW DELIVERY REQUEST</Text>
          </View>
          <Pressable style={styles.declineTop} onPress={() => onDecline(job.id)} accessibilityRole="button" accessibilityLabel="Decline delivery request">
            <Ionicons name="close" size={23} color="#713f12" />
          </Pressable>
        </View>

        <View style={styles.details}>
          <Text style={styles.payoutLabel}>YOUR PAYOUT</Text>
          <Text style={styles.payout}>KES {Number(job.estimatedPrice ?? 0).toLocaleString("en-KE")}</Text>
          <Text style={styles.distance}>{job.distanceToPickupKm.toFixed(1)} km to pickup</Text>
          <View style={styles.pickupCard}>
            <Ionicons name="location" size={19} color="#92400e" />
            <Text style={styles.pickupText} numberOfLines={2}>{job.pickupAddress || "Pickup location provided in trip details"}</Text>
          </View>
          <View style={styles.cargoCard}>
            <Ionicons name="cube-outline" size={19} color="#92400e" />
            <Text style={styles.cargoText}>{[job.loadSize, job.loadDescription].filter(Boolean).join(" · ") || "Goods delivery"}</Text>
          </View>
          <View style={styles.timerWrap} accessibilityLabel={`${secondsLeft} seconds to respond`}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="none" stroke="#fcd34d" strokeWidth={RING_STROKE} />
              <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="none" stroke="#713f12" strokeWidth={RING_STROKE} strokeLinecap="round" strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={ringOffset} rotation={-90} origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`} />
            </Svg>
            <Text style={styles.timerNumber}>{secondsLeft}</Text>
          </View>
          <Text style={styles.timerHint}>seconds to respond</Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={({ pressed }) => [styles.acceptButton, { height: height * 0.24 }, pressed && styles.pressed, accepting && styles.disabled]} onPress={() => onAccept(job.id)} disabled={accepting || secondsLeft === 0} accessibilityRole="button">
            <Text style={styles.acceptText}>{accepting ? "Accepting…" : "Accept delivery"}</Text>
          </Pressable>
          <Pressable style={[styles.declineBottom, { minHeight: height * 0.06 }]} onPress={() => onDecline(job.id)} accessibilityRole="button">
            <Text style={styles.declineText}>Decline request</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#fbbf24", paddingHorizontal: 20, justifyContent: "space-between" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8 },
  arrivalLabel: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fde68a", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  arrivalText: { color: "#713f12", fontSize: 12, fontWeight: "900", letterSpacing: 0.6 },
  declineTop: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#fde68a" },
  details: { alignItems: "center", gap: 12, paddingVertical: 12 },
  payoutLabel: { color: "#78350f", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  payout: { color: "#451a03", fontSize: 42, fontWeight: "900", textAlign: "center" },
  distance: { color: "#713f12", fontSize: 17, fontWeight: "800" },
  pickupCard: { width: "100%", minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fde68a", borderRadius: 16 },
  pickupText: { flex: 1, color: "#451a03", fontSize: 15, fontWeight: "800" },
  cargoCard: { width: "100%", flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fde68a", borderRadius: 16 },
  cargoText: { flex: 1, color: "#713f12", fontSize: 15, fontWeight: "700" },
  timerWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center", marginTop: 4 },
  timerNumber: { position: "absolute", color: "#451a03", fontSize: 32, fontWeight: "900" },
  timerHint: { color: "#713f12", fontSize: 13, fontWeight: "700" },
  actions: { gap: 8, paddingBottom: 8 },
  acceptButton: { minHeight: 56, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#14532d" },
  acceptText: { color: "#fff", fontSize: 20, fontWeight: "900" },
  declineBottom: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  declineText: { color: "#713f12", fontSize: 15, fontWeight: "800" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.65 },
});
