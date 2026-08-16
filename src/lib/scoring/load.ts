import { ScoredDay } from "./engine";

/**
 * Acute vs chronic training load — the workload-management view of Strain.
 *
 * Acute load  = your average daily strain over the last ~7 days (recent fatigue).
 * Chronic load = your average daily strain over the last ~28 days (fitness base).
 * Their ratio (acute : chronic, "ACWR") says whether you're ramping up faster
 * than your body has adapted to, holding steady, or backing off.
 *
 * This is a personal, interpretable model built on CURA's own 0–21 strain — not
 * a copy of any one product's formula — and it is never medical advice.
 */
export interface TrainingLoad {
  available: boolean;
  acute: number;
  chronic: number;
  ratio: number;
  status: "detraining" | "balanced" | "ramping" | "overreaching";
  label: string;
  guidance: string;
  confidence: "low" | "medium" | "high";
  acuteDays: number;
  chronicDays: number;
}

const ACUTE_WINDOW = 7;
const CHRONIC_WINDOW = 28;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Daily strain scores for the most recent `n` days that actually have strain. */
function recentStrain(days: ScoredDay[], n: number): number[] {
  const out: number[] = [];
  for (let i = days.length - 1; i >= 0 && out.length < n; i--) {
    if (days[i].strain.available !== false) out.push(days[i].strain.score);
  }
  return out;
}

export function trainingLoad(days: ScoredDay[]): TrainingLoad {
  const acuteVals = recentStrain(days, ACUTE_WINDOW);
  const chronicVals = recentStrain(days, CHRONIC_WINDOW);
  const acute = Math.round(mean(acuteVals) * 10) / 10;
  const chronic = Math.round(mean(chronicVals) * 10) / 10;

  // Need at least a week of history before acute:chronic means anything.
  if (chronicVals.length < 7 || chronic <= 0) {
    return {
      available: false, acute, chronic, ratio: 0, status: "balanced",
      label: "Building your baseline", guidance: "Keep logging activity — after about a week CURA can show whether you're ramping up or backing off relative to your own normal.",
      confidence: "low", acuteDays: acuteVals.length, chronicDays: chronicVals.length,
    };
  }

  const ratio = Math.round((acute / chronic) * 100) / 100;
  const confidence = chronicVals.length >= CHRONIC_WINDOW ? "high" : chronicVals.length >= 14 ? "medium" : "low";

  let status: TrainingLoad["status"];
  let label: string;
  let guidance: string;
  if (ratio < 0.8) {
    status = "detraining";
    label = "Backing off";
    guidance = "Your recent load is below your normal — fine for a deload, but a long stretch here lets fitness fade. A steady session or two brings you back to balance.";
  } else if (ratio <= 1.3) {
    status = "balanced";
    label = "Balanced";
    guidance = "Your recent load sits right around your normal — a sustainable place to build fitness without digging a fatigue hole.";
  } else if (ratio <= 1.5) {
    status = "ramping";
    label = "Ramping up";
    guidance = "You're training up faster than usual. That's how fitness grows — just protect recovery and sleep so the extra load sticks.";
  } else {
    status = "overreaching";
    label = "Overreaching";
    guidance = "Your recent load is well above what your body is adapted to. Higher strain-injury risk — prioritise recovery, and consider an easier day before the next hard one.";
  }

  return { available: true, acute, chronic, ratio, status, label, guidance, confidence, acuteDays: acuteVals.length, chronicDays: chronicVals.length };
}
