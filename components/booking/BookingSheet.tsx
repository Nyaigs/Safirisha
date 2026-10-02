import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { design } from "../../constants/design";
import { LOAD_SIZE_OPTIONS } from "../../constants/loadsizes";
import { VEHICLES } from "../../constants/vehicles";
import { DeliveryCategory, useBookingFlow } from "../../hooks/useBookingFlow";
import { AppLocation, DropoffPlace, VehicleId } from "../../types";
import { getPriceBreakdown } from "../../utils/pricing";
import { AppButton } from "../ui/app-button";
import { LocationStep } from "./LocationStep";

type Flow = ReturnType<typeof useBookingFlow>;
type Props = {
  flow: Flow;
  currentLocation: AppLocation | null;
  loadingLocation: boolean;
  submitting: boolean;
  onCurrentLocation: () => void;
  onMapPick: () => void;
  onSearch: (place: DropoffPlace) => void;
  onOpenSearch: (kind: "pickup" | "dropoff") => void;
  onSubmit: () => void;
};

const categories: DeliveryCategory[] = ["Package", "Documents", "Shopping", "Groceries", "Electronics", "Furniture", "Food", "Other"];

export function BookingSheet({ flow, currentLocation, loadingLocation, submitting, onCurrentLocation, onMapPick, onSearch, onOpenSearch, onSubmit }: Props) {
  const isLocation = flow.step === "pickup" || flow.step === "dropoff";

  const primaryAction = useMemo(() => {
    switch (flow.step) {
      case "idle":
        return { label: "Set pickup location", onPress: () => flow.setStep("pickup") };
      case "details":
        return { label: "Choose load size", onPress: () => flow.setStep("load") };
      case "load":
        return { label: "Choose vehicle", onPress: () => flow.setStep("vehicle"), disabled: !flow.loadSize || !flow.hasValidLoadDescription };
      case "vehicle":
        return { label: "Review request", onPress: () => flow.setStep("confirm"), disabled: !flow.selectedVehicle };
      case "confirm":
        return { label: "Request Safirisha", onPress: onSubmit, loading: submitting };
      default:
        return null;
    }
  }, [flow.step, flow.loadSize, flow.hasValidLoadDescription, flow.selectedVehicle, submitting, onSubmit, flow]);

  return (
    <View style={styles.sheet}>
      {flow.step !== "idle" && (
        <TouchableOpacity style={styles.back} onPress={flow.back}>
          <Ionicons name="arrow-back" size={20} color={design.colors.ink} />
        </TouchableOpacity>
      )}
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.content}>
        {flow.step === "idle" && (
          <>
            <Text style={styles.title}>What do you need moved?</Text>
            <Text style={styles.subtitle}>Start with pickup, choose a destination, then select the right vehicle.</Text>
          </>
        )}

        {isLocation && (
          <LocationStep
            key={flow.step}
            kind={flow.step as "pickup" | "dropoff"}
            currentLocation={currentLocation}
            loadingLocation={loadingLocation}
            onCurrent={onCurrentLocation}
            onOpenSearch={() => onOpenSearch(flow.step as "pickup" | "dropoff")}
            onMapPick={onMapPick}
          />
        )}

        {flow.step === "details" && (
          <>
            <Text style={styles.title}>What are you sending?</Text>
            <Text style={styles.subtitle}>Choose a category to help drivers prepare. Details are optional unless you select a custom load.</Text>
            <View style={styles.chips}>
              {categories.map((item) => (
                <TouchableOpacity key={item} onPress={() => flow.setCategory(item)} style={[styles.chip, flow.category === item && styles.chipActive]}>
                  <Text style={[styles.chipText, flow.category === item && styles.chipTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput value={flow.notes} onChangeText={flow.setNotes} placeholder="Special instructions (optional)" placeholderTextColor={design.colors.muted} style={styles.input} />
            <View style={styles.toggle}>
              <Text style={styles.actionTitle}>Handle with care</Text>
              <Switch value={flow.fragile} onValueChange={flow.setFragile} trackColor={{ true: design.colors.brand }} />
            </View>
          </>
        )}

        {flow.step === "load" && (
          <>
            <Text style={styles.title}>Select load size</Text>
            {LOAD_SIZE_OPTIONS.map((item) => (
              <TouchableOpacity key={item.key} onPress={() => flow.setLoadSize(item.key)} style={[styles.option, flow.loadSize === item.key && styles.optionActive]}>
                <Text style={styles.actionTitle}>{item.label}</Text>
                <Text style={styles.actionMeta}>{item.weightRange} · {item.description}</Text>
              </TouchableOpacity>
            ))}
            {flow.loadSize === "Custom" && (
              <TextInput value={flow.description} onChangeText={flow.setDescription} placeholder="Describe what you need moved (required)" placeholderTextColor={design.colors.muted} style={styles.input} />
            )}
            {flow.loadSize && flow.loadSize !== "Custom" && (
              <TextInput value={flow.description} onChangeText={flow.setDescription} placeholder="Load details (optional)" placeholderTextColor={design.colors.muted} style={styles.input} />
            )}
          </>
        )}

        {flow.step === "vehicle" && (
          <>
            <Text style={styles.title}>Choose a vehicle</Text>
            <Text style={styles.subtitle}>{flow.distanceKm} km straight-line distance, not road distance. Driver availability is checked after requesting.</Text>
            {VEHICLES.filter((item) => flow.suitableVehicleIds.includes(item.id)).map((item) => {
              const price = getPriceBreakdown(item.id, flow.loadSize, flow.distanceKm, flow.fragile).total;
              const selected = flow.selectedVehicle === item.id;
              return (
                <TouchableOpacity key={item.id} onPress={() => flow.setVehicle(item.id as VehicleId)} style={[styles.vehicle, selected && styles.optionActive]}>
                  <MaterialCommunityIcons name={item.icon} size={26} color={design.colors.brand} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionTitle}>{item.name}{flow.recommendedVehicle === item.id ? " · Recommended" : ""}</Text>
                    <Text style={styles.actionMeta}>{item.capacity}</Text>
                  </View>
                  <Text style={styles.price}>KES {price.toLocaleString()}</Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {flow.step === "confirm" && (() => {
          const breakdown = getPriceBreakdown(flow.selectedVehicle, flow.loadSize, flow.distanceKm, flow.fragile);
          return (
            <>
              <Text style={styles.title}>Ready to request?</Text>
              <Text style={styles.subtitle}>Pickup: {flow.pickup?.address}{"\n"}Drop-off: {flow.dropoff?.address}</Text>
              <View style={styles.summary}>
                <Text style={styles.actionTitle}>{VEHICLES.find((item) => item.id === flow.selectedVehicle)?.name} · {flow.loadSize}</Text>
                <Text style={styles.actionMeta}>{flow.description || flow.category || "General delivery"}{flow.fragile ? " · Fragile" : ""}</Text>
                <Text style={styles.actionMeta}>Base fare · KES {breakdown.baseFare.toLocaleString()}</Text>
                <Text style={styles.actionMeta}>Distance ({flow.distanceKm} km) · KES {breakdown.distanceCharge.toLocaleString()}</Text>
                {breakdown.loadAdjustment > 0 && (
                  <Text style={styles.actionMeta}>Load adjustment · KES {breakdown.loadAdjustment.toLocaleString()}</Text>
                )}
                {breakdown.fragileAdjustment > 0 && (
                  <Text style={styles.actionMeta}>Handle with care · +KES {breakdown.fragileAdjustment.toLocaleString()}</Text>
                )}
                {breakdown.surgeMultiplier > 1 && (
                  <Text style={styles.actionMeta}>{breakdown.surgeReason} · ×{breakdown.surgeMultiplier.toFixed(2)} · +KES {breakdown.surgeAdjustment.toLocaleString()}</Text>
                )}
                {breakdown.appliedMinFare && (
                  <Text style={styles.actionMeta}>Minimum fare applied</Text>
                )}
                <Text style={styles.total}>Estimated total · KES {breakdown.total.toLocaleString()}</Text>
              </View>
              <TouchableOpacity onPress={flow.back} style={styles.edit}>
                <Text style={styles.mapActionText}>Edit request</Text>
              </TouchableOpacity>
            </>
          );
        })()}
        {primaryAction && (
          <View style={styles.inlineFooter}>
            <AppButton label={primaryAction.label} onPress={primaryAction.onPress} disabled={primaryAction.disabled} loading={primaryAction.loading} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingBottom: design.spacing.lg },
  back: { width: 34, height: 34, justifyContent: "center" },
  title: { ...design.typography.title, color: design.colors.ink },
  subtitle: { ...design.typography.body, color: design.colors.muted, marginTop: 4, marginBottom: design.spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: design.spacing.xs, marginBottom: design.spacing.md },
  chip: { paddingHorizontal: design.spacing.sm, paddingVertical: 10, borderRadius: design.radius.pill, backgroundColor: design.colors.subtle },
  chipActive: { backgroundColor: design.colors.brand },
  chipText: { ...design.typography.caption, color: design.colors.ink },
  chipTextActive: { color: design.colors.white },
  input: { borderWidth: 1, borderColor: design.colors.border, padding: design.spacing.sm, borderRadius: design.radius.md, color: design.colors.ink, marginBottom: design.spacing.sm, ...design.typography.body },
  toggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: design.spacing.md },
  actionTitle: { ...design.typography.label, color: design.colors.ink },
  actionMeta: { ...design.typography.caption, color: design.colors.muted, marginTop: 3 },
  option: { borderWidth: 1, borderColor: design.colors.border, borderRadius: design.radius.md, padding: design.spacing.sm, marginBottom: design.spacing.xs },
  optionActive: { borderColor: design.colors.brand, backgroundColor: design.colors.brandSoft },
  vehicle: { flexDirection: "row", alignItems: "center", gap: design.spacing.sm, borderWidth: 1, borderColor: design.colors.border, borderRadius: design.radius.md, padding: design.spacing.sm, marginBottom: design.spacing.xs },
  price: { ...design.typography.label, color: design.colors.success },
  summary: { padding: design.spacing.md, backgroundColor: design.colors.subtle, borderRadius: design.radius.md, marginBottom: design.spacing.md },
  total: { ...design.typography.title, color: design.colors.brand, marginTop: design.spacing.sm },
  edit: { alignItems: "center", padding: design.spacing.sm },
  mapActionText: { ...design.typography.label, color: design.colors.brand },
  inlineFooter: { paddingTop: design.spacing.md },
  paymentRow: {
    marginTop: design.spacing.sm,
    marginBottom: design.spacing.sm,
  },
  paymentLabel: {
    ...design.typography.caption,
    color: design.colors.muted,
    fontWeight: "600",
    marginBottom: design.spacing.xs,
  },
  paymentOptions: {
    flexDirection: "row",
    gap: design.spacing.sm,
  },
  paymentOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: design.spacing.xs,
    paddingVertical: design.spacing.sm,
    borderRadius: design.radius.md,
    borderWidth: 1,
    borderColor: design.colors.border,
    backgroundColor: design.colors.surface,
  },
  paymentOptionActive: {
    backgroundColor: design.colors.ink,
    borderColor: design.colors.ink,
  },
  paymentOptionText: {
    ...design.typography.label,
    color: design.colors.ink,
  },
  paymentOptionTextActive: {
    color: design.colors.white,
  },
});
