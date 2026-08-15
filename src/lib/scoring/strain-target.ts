import { clamp } from "../format";

/**
 * Optimal strain target for today — WHOOP-style. Your body's readiness (recovery)
 * sets how much load to take on: high recovery → push, low recovery → hold back.
 * The target is scaled by recovery and nudged toward YOUR typical daily strain so
 * it stays realistic, then paired with recovery-appropriate activity ideas.
 * Deterministic heuristic, not medical advice.
 */

export type StrainZone = "rest" | "maintain" | "build" | "push";

export interface StrainTarget {
  available: boolean;
  target: number; // optimal day strain (0–21)
  low: number;
  high: number;
  zone: StrainZone;
  headline: string;
  guidance: string;
  activities: string[];
}

const ACTIVITIES: Record<StrainZone, string[]> = {
  push: ["Intervals or hard tempo", "Long run / ride", "Heavy strength session", "Competitive sport"],
  build: ["Steady zone-2 cardio", "Moderate strength", "Skills / technique work", "Brisk 45–60 min"],
  maintain: ["Easy cardio", "Light strength or mobility", "A long walk", "Yoga or an easy swim"],
  rest: ["Prioritise rest today", "Gentle walk", "Stretching & mobility", "Breathwork or easy yoga"],
};

const HEADLINE: Record<StrainZone, string> = { push: "Push day", build: "Build day", maintain: "Maintain", rest: "Rest & recover" };

export function strainTarget(recovery: number | null, baselineStrain: number): StrainTarget {
  const base: StrainTarget = { available: false, target: 0, low: 0, high: 0, zone: "maintain", headline: "", guidance: "", activities: [] };
  if (recovery == null || !isFinite(recovery)) return base;

  // Map recovery (0–100) to an optimal strain, then blend toward the user's own
  // typical load so the target is achievable for them.
  const fromRecovery = clamp(4 + (recovery / 100) * 14, 4, 19); // 100→18, 50→11, 0→4
  const blended = clamp(fromRecovery * 0.7 + (isFinite(baselineStrain) ? baselineStrain : 10) * 0.3, 3, 20);
  const target = Math.round(blended * 10) / 10;
  const low = Math.round(clamp(blended - 2, 0, 21) * 10) / 10;
  const high = Math.round(clamp(blended + 2, 0, 21) * 10) / 10;

  const zone: StrainZone = recovery >= 67 ? "push" : recovery >= 50 ? "build" : recovery >= 34 ? "maintain" : "rest";
  const guidance =
    zone === "push" ? `Recovery is high (${Math.round(recovery)}%) — your body can take on more today. Aim for around ${target.toFixed(1)} strain.`
    : zone === "build" ? `Recovery is solid (${Math.round(recovery)}%) — a productive day at moderate load. Aim for around ${target.toFixed(1)}.`
    : zone === "maintain" ? `Recovery is middling (${Math.round(recovery)}%) — keep it steady and don't dig a hole. Around ${target.toFixed(1)} is plenty.`
    : `Recovery is low (${Math.round(recovery)}%) — hold back and let your body catch up. Keep strain near ${target.toFixed(1)}.`;

  return { available: true, target, low, high, zone, headline: HEADLINE[zone], guidance, activities: ACTIVITIES[zone] };
}
