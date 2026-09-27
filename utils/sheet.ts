/** Pure sheet geometry, shared by the gesture worklet and regression tests. */
export function sheetSnapOffsets(height: number, points: readonly number[]) {
  return points.map((point) => height * (1 - Math.min(100, Math.max(0, point)) / 100));
}

export function clampSheetDrag(start: number, translation: number, offsets: readonly number[]) {
  "worklet";
  return Math.min(Math.max(start + translation, Math.min(...offsets)), Math.max(...offsets));
}

export function nearestSheetSnap(position: number, velocity: number, offsets: readonly number[]) {
  "worklet";
  const projected = position + velocity * 0.15;
  return offsets.reduce((closest, offset) => Math.abs(projected - offset) < Math.abs(projected - closest) ? offset : closest, offsets[0] ?? 0);
}
