import { apiFetch } from "./api";

export async function submitRating(tripId: string, rating: number, comment?: string) {
  return apiFetch(`/trips/${tripId}/rating`, {
    method: "POST",
    body: { rating, feedback: comment?.trim() || undefined },
  });
}
