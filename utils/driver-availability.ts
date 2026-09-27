export type DriverAvailability = "ONLINE" | "OFFLINE" | "BUSY";

/** BUSY remains online in the UI, but does not imply eligibility for new jobs. */
export function isDriverOnline(availability: string | null | undefined): boolean {
  return availability === "ONLINE" || availability === "BUSY";
}

export type AvailabilityDecision = {
  isOnline: boolean;
  isToggling: boolean;
  errorMessage: string | null;
};

/**
 * Availability changes only when the backend echoes the requested value.
 * Anything else leaves the current flag untouched and reports why.
 */
export function applyAvailabilityResponse(
  currentIsOnline: boolean,
  requested: DriverAvailability,
  response: { availability?: string } | null | undefined,
): AvailabilityDecision {
  if (response?.availability !== requested) {
    return {
      isOnline: currentIsOnline,
      isToggling: false,
      errorMessage: `The server did not confirm going ${requested === "ONLINE" ? "online" : "offline"}. Refresh and try again.`,
    };
  }
  return { isOnline: isDriverOnline(requested), isToggling: false, errorMessage: null };
}
