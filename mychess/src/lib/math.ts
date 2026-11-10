export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/** Lichess public win% curve. Centipawns are from the side being measured. */
export function winPercentFromCp(cp: number) {
  const capped = clamp(cp, -1000, 1000);
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * capped)) - 1);
}

/** Lichess public move-accuracy curve. `loss` is win-percent points given away. */
export function accuracyFromWinLoss(loss: number) {
  const raw = 103.1668 * Math.exp(-0.04354 * Math.max(0, loss)) - 3.1669;
  return clamp(raw, 0, 100);
}

export function scoreToCp(cp: number | null, mate: number | null) {
  if (mate != null) {
    const sign = mate > 0 ? 1 : -1;
    return sign * (100000 - Math.min(Math.abs(mate), 40) * 80);
  }
  return cp ?? 0;
}

export function toWhitePerspective(
  cp: number | null,
  mate: number | null,
  turn: "w" | "b",
) {
  const signed = scoreToCp(cp, mate);
  if (turn === "w") return { cp: signed, mate };
  return { cp: -signed, mate: mate == null ? null : -mate };
}

export function formatEval(cp: number, mate?: number | null) {
  if (mate != null && mate !== 0) return `${mate > 0 ? "+" : "-"}#${Math.abs(mate)}`;
  const pawns = cp / 100;
  const rounded = Math.abs(pawns) >= 10 ? pawns.toFixed(1) : pawns.toFixed(2);
  return `${pawns > 0 ? "+" : ""}${rounded}`;
}

export function formatAccuracy(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(1);
}

export function harmonicMean(values: number[]) {
  const safe = values.map((value) => clamp(value, 1, 100));
  if (!safe.length) return 0;
  const denom = safe.reduce((sum, value) => sum + 1 / value, 0);
  return safe.length / denom;
}

export function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function studyAccuracy(values: number[]) {
  if (!values.length) return 0;
  return Math.round((0.55 * harmonicMean(values) + 0.45 * mean(values)) * 10) / 10;
}

/** A rough study curve, not a published rating formula. */
export function estimateRating(accuracy: number, acpl: number) {
  const fromAccuracy = 380 + Math.pow(clamp(accuracy, 0, 100) / 100, 1.55) * 2350;
  const fromAcpl = acpl <= 1 ? 2500 : clamp(2780 - 360 * Math.log(acpl + 6), 500, 2700);
  return Math.round(fromAccuracy * 0.62 + fromAcpl * 0.38);
}

export function round1(value: number) {
  return Math.round(value * 10) / 10;
}
