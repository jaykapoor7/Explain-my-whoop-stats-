import { analyzeUser } from "../index";
import { estimateResponse } from "../response";
import type { DriverSpec } from "../response";
import {
  stableHealthy, chronicLowHrv, recoveryCrash, gradualImprovement, gradualDeterioration,
  noisyMissing, newUser, deviceSwitch, conflicting, strongIntervention,
} from "./synthetic";

/**
 * Evaluation harness. Runs the analytics engine against ten synthetic
 * longitudinal users and asserts it behaves — crucially, that it does NOT cry
 * wolf on a healthy user. Run: `npm run test:analytics`.
 */

// Reach the Node exit via globalThis so the harness compiles with or without
// @types/node present, and never clashes with an ambient `process` global.
const exit = (code: number) => (globalThis as unknown as { process: { exit(n: number): never } }).process.exit(code);

let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean) {
  if (cond) passed++;
  else failures.push(name);
}

// 1. Stable healthy — baseline learned, no alarms, high confidence.
{
  const m = analyzeUser(stableHealthy(), { actualAge: 30 });
  check("stable: hrv baseline ~65", Math.abs((m.baselines.hrv?.median ?? 0) - 65) < 5);
  check("stable: not insufficient", !m.baselines.hrv?.insufficient);
  check("stable: stage personalized+", m.stage === "personalized" || m.stage === "high-confidence");
  check("stable: NO recovery-crash event", !m.events.some((e) => e.type === "recovery-crash"));
  check("stable: NO elevated events (no false alarms)", !m.events.some((e) => e.severity === "elevated"));
  check("stable: state not Low recovery", m.state.label !== "Low recovery");
  check("stable: health age available", m.healthAge.available);
}

// 2. Chronically low HRV — low is NORMAL for them, not flagged.
{
  const m = analyzeUser(chronicLowHrv(), { actualAge: 35 });
  check("chronicLow: baseline ~40 (personal)", Math.abs((m.baselines.hrv?.median ?? 0) - 40) < 5);
  check("chronicLow: today not flagged (|z|<1.5)", Math.abs(m.baselines.hrv?.z ?? 9) < 1.5);
  check("chronicLow: NO recovery-crash", !m.events.some((e) => e.type === "recovery-crash"));
}

// 3. Recovery crash — detected.
{
  const m = analyzeUser(recoveryCrash(), { actualAge: 28 });
  check("crash: today well below baseline", (m.baselines.hrv?.z ?? 0) <= -1.5);
  check("crash: fires crash or sustained-low event", m.events.some((e) => e.type === "recovery-crash" || e.type === "sustained-low-hrv"));
  check("crash: state is Low/Moderate recovery", ["Low recovery", "Moderate"].includes(m.state.label));
}

// 4. Gradual improvement — trajectory up.
{
  const m = analyzeUser(gradualImprovement(), { actualAge: 25 });
  check("improve: trajectory improving", m.trajectory.direction === "improving");
  check("improve: hrv long-trend improving", m.layered.find((l) => l.key === "hrv")?.trajectory.movement === "improving");
  check("improve: health-age trajectory improving", m.healthAge.trajectory === "improving");
}

// 5. Gradual deterioration — trajectory down.
{
  const m = analyzeUser(gradualDeterioration(), { actualAge: 40 });
  check("decline: trajectory declining", m.trajectory.direction === "declining");
}

// 6. Noisy/missing — honest low confidence, no crash.
{
  const m = analyzeUser(noisyMissing(), { actualAge: 33 });
  check("noisy: high missingness flagged", m.dataQuality.missingnessPct >= 30);
  check("noisy: confidence held down", (m.baselines.hrv?.confidence ?? 1) < 0.8);
}

// 7. New user — cold start, no fake conclusions.
{
  const m = analyzeUser(newUser(), { actualAge: 22 });
  check("new: stage new/learning", m.stage === "new" || m.stage === "learning");
  check("new: no high-confidence state", m.state.confidence !== "high");
  check("new: few/no insights", m.insights.length <= 3);
}

// 8. Device switch — baseline drift detected.
{
  const m = analyzeUser(deviceSwitch(), { actualAge: 31 });
  check("deviceSwitch: hrv baseline drift rising", m.baselines.hrv?.drift === "rising");
}

// 9. Conflicting signals — one metric off ≠ high confidence.
{
  const m = analyzeUser(conflicting(), { actualAge: 29 });
  check("conflicting: state not high confidence", m.state.confidence !== "high");
}

// 10. Strong intervention — response model finds the effect.
{
  const days = strongIntervention();
  const driver: DriverSpec = { kind: "behavior", id: "early", label: "Earlier bedtime", present: (d) => new Date(d.sleep.bedtime).getHours() < 23 };
  const est = estimateResponse(days, driver, "hrv", 1);
  check("intervention: response estimate exists", !!est);
  check("intervention: earlier bed → higher next-day HRV", !!est && est.direction === "increases" && est.diff > 0);
  check("intervention: not insufficient confidence", !!est && est.confidence !== "insufficient");
}

const total = passed + failures.length;
console.log(`\nAnalytics engine evaluation: ${passed}/${total} checks passed`);
if (failures.length) {
  console.log("FAILED:");
  for (const f of failures) console.log("  ✗ " + f);
  exit(1);
} else {
  console.log("All checks passed ✓");
}
