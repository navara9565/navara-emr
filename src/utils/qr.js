// Deep link keyed by the physical bed, not the patient — stays correct
// across admissions/discharges so the printed card never needs reprinting.
export function scanBedUrl(bedId) {
  const base = window.location.href.split("#")[0];
  return base + "#/scan-bed/" + encodeURIComponent(bedId);
}

// Common nursing vital-sign rounds (each time period of the day).
export const VITAL_ROUNDS = ["02:00", "06:00", "10:00", "14:00", "18:00", "22:00"];

// Nearest round to the current clock time (for a sensible default).
export function suggestRound(now = new Date()) {
  const mins = now.getHours() * 60 + now.getMinutes();
  let best = VITAL_ROUNDS[0];
  let bestDiff = Infinity;
  for (const r of VITAL_ROUNDS) {
    const [h, m] = r.split(":").map(Number);
    const diff = Math.abs(h * 60 + m - mins);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = r;
    }
  }
  return best;
}
