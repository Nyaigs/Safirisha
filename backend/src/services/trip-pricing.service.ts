import {
    calculateTripEarnings,
    DEFAULT_PLATFORM_FEE_PERCENT,
} from "./earnings.service";

export function buildTripFinancials(estimatedPrice: number) {
  return calculateTripEarnings(estimatedPrice, DEFAULT_PLATFORM_FEE_PERCENT);
}
