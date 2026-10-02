import { useCallback, useMemo, useState } from "react";
import { getLoadSizeByKey } from "../constants/loadsizes";
import { VEHICLES } from "../constants/vehicles";
import { AppLocation, LoadSize, VehicleId } from "../types";
import type { PaymentMethod } from "../utils/booking";
import {
  BookingDraft,
  BookingStep,
  DeliveryCategory,
  INITIAL_BOOKING_DRAFT,
  buildRequestPayload,
  chooseDropoffInDraft,
  choosePickupInDraft,
  distanceBetweenKm,
  hasValidLoadDescription,
  previousBookingStep,
} from "../utils/booking";
import { estimatePrice } from "../utils/pricing";

export type { BookingStep, DeliveryCategory };

export function useBookingFlow() {
  const [draft, setDraft] = useState<BookingDraft>(INITIAL_BOOKING_DRAFT);
  const { step, pickup, dropoff, category, description, notes, fragile, loadSize, vehicle } = draft;

  const setStep = useCallback((next: BookingStep) => setDraft((current) => ({ ...current, step: next })), []);
  const setCategory = useCallback((category: DeliveryCategory | null) => setDraft((current) => ({ ...current, category })), []);
  const setDescription = useCallback((description: string) => setDraft((current) => ({ ...current, description })), []);
  const setNotes = useCallback((notes: string) => setDraft((current) => ({ ...current, notes })), []);
  const setFragile = useCallback((fragile: boolean) => setDraft((current) => ({ ...current, fragile })), []);
  const setLoadSize = useCallback((loadSize: LoadSize | null) => setDraft((current) => ({ ...current, loadSize, vehicle: null })), []);
  const setVehicle = useCallback((vehicle: VehicleId | null) => setDraft((current) => ({ ...current, vehicle })), []);
  const setPaymentMethod = useCallback((paymentMethod: PaymentMethod) => setDraft((current) => ({ ...current, paymentMethod })), []);

  const distanceKm = useMemo(() => pickup && dropoff ? distanceBetweenKm(pickup, dropoff) : 0, [pickup, dropoff]);
  const suitableVehicleIds = useMemo(() => {
    if (!loadSize) return [];
    return VEHICLES.filter((vehicleItem) => vehicleItem.supportedLoadSizes.includes(loadSize)).map((vehicleItem) => vehicleItem.id);
  }, [loadSize]);
  const recommendedVehicle = suitableVehicleIds[0] ?? null;
  const selectedVehicle = vehicle ?? recommendedVehicle;
  const estimatedPrice = useMemo(() => estimatePrice(selectedVehicle, loadSize, distanceKm), [distanceKm, loadSize, selectedVehicle]);

  const choosePickup = useCallback((location: AppLocation) => {
    setDraft((current) => choosePickupInDraft(current, location));
  }, []);
  const chooseDropoff = useCallback((location: AppLocation) => {
    setDraft((current) => chooseDropoffInDraft(current, location));
  }, []);
  const back = useCallback(() => setDraft((current) => ({ ...current, step: previousBookingStep(current.step) })), []);
  const validLoadDescription = hasValidLoadDescription(loadSize, description);
  const requestPayload = useMemo(
    () => buildRequestPayload(draft, selectedVehicle, distanceKm, estimatedPrice),
    [draft, selectedVehicle, distanceKm, estimatedPrice],
  );

  return { step, setStep, pickup, dropoff, category, setCategory, description, setDescription, notes, setNotes, fragile, setFragile, loadSize, setLoadSize, vehicle, setVehicle, selectedVehicle, recommendedVehicle, suitableVehicleIds, estimatedPrice, distanceKm, choosePickup, chooseDropoff, back, requestPayload, loadSizeInfo: getLoadSizeByKey(loadSize), hasValidLoadDescription: validLoadDescription };
}
