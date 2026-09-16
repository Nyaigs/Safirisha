import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { submitRating } from "../../lib/rating";

export default function RateTripScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const finish = () => router.replace("/(customer)/(tabs)/activity");
  const submit = async () => {
    if (!tripId || rating === 0) {
      Alert.alert("Choose a rating", "Tap one to five stars to rate this delivery.");
      return;
    }
    try {
      setSubmitting(true);
      await submitRating(tripId, rating, feedback);
      Alert.alert("Thank you", "Your feedback helps us improve Safirisha.", [{ text: "Done", onPress: finish }]);
    } catch (error: unknown) {
      Alert.alert("Rating not saved", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return <SafeAreaView style={styles.screen}><View style={styles.card}>
    <View style={styles.icon}><Ionicons name="checkmark" size={34} color="#fff" /></View>
    <Text style={styles.title}>Delivery complete</Text>
    <Text style={styles.subtitle}>How was your Safirisha delivery experience?</Text>
    <View style={styles.stars}>{[1, 2, 3, 4, 5].map((value) => <TouchableOpacity key={value} onPress={() => setRating(value)} accessibilityLabel={`${value} star rating`}><Ionicons name={value <= rating ? "star" : "star-outline"} size={40} color={value <= rating ? "#F59E0B" : "#CBD5E1"} /></TouchableOpacity>)}</View>
    <TextInput value={feedback} onChangeText={setFeedback} maxLength={1000} multiline placeholder="Tell us more (optional)" placeholderTextColor="#94A3B8" style={styles.input} />
    <TouchableOpacity style={[styles.button, (!rating || submitting) && styles.buttonDisabled]} onPress={submit} disabled={!rating || submitting}>{submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit rating</Text>}</TouchableOpacity>
    <TouchableOpacity style={styles.skip} onPress={finish} disabled={submitting}><Text style={styles.skipText}>Maybe later</Text></TouchableOpacity>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({ screen: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#F8FAFC" }, card: { backgroundColor: "#fff", borderRadius: 24, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" }, icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#059669", justifyContent: "center", alignItems: "center", marginBottom: 18 }, title: { fontSize: 24, fontWeight: "800", color: "#0F172A" }, subtitle: { color: "#64748B", textAlign: "center", lineHeight: 21, marginTop: 8 }, stars: { flexDirection: "row", gap: 6, marginVertical: 24 }, input: { width: "100%", minHeight: 96, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 14, padding: 13, color: "#0F172A", textAlignVertical: "top" }, button: { width: "100%", alignItems: "center", justifyContent: "center", minHeight: 52, borderRadius: 14, backgroundColor: "#111827", marginTop: 16 }, buttonDisabled: { opacity: 0.5 }, buttonText: { color: "#fff", fontWeight: "800" }, skip: { padding: 16 }, skipText: { color: "#475569", fontWeight: "700" } });
