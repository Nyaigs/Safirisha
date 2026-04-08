export const DEFAULT_PLATFORM_FEE_PERCENT = 10;

function roundTo2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateTripEarnings(
  grossFare: number,
  platformFeePercent = DEFAULT_PLATFORM_FEE_PERCENT,
) {
  const safeFare = Number.isFinite(grossFare) ? Math.max(0, grossFare) : 0;
  const safePercent = Number.isFinite(platformFeePercent)
    ? Math.max(0, platformFeePercent)
    : DEFAULT_PLATFORM_FEE_PERCENT;

  const platformFeeAmount = roundTo2((safeFare * safePercent) / 100);
  const driverNetEarning = roundTo2(safeFare - platformFeeAmount);

  return {
    grossFare: roundTo2(safeFare),
    platformFeePercent: roundTo2(safePercent),
    platformFeeAmount,
    driverNetEarning,
  };
}
