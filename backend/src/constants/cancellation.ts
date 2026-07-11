export const CANCELLATION_FEES = {
  CUSTOMER: {
    SEARCHING: 0,
    ACCEPTED: 50, // KES
    DRIVER_EN_ROUTE: 50,
  },
  DRIVER: {
    ACCEPTED: 30, // penalty for driver cancelling after accepting
    DRIVER_EN_ROUTE: 50, // higher penalty if already en route
  },
};
