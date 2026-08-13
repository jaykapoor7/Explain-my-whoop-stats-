"use client";

import { ScorePage } from "@/components/score-page";
import { DOMAIN_COLOR } from "@/lib/format";

export default function EnergyPage() {
  return (
    <ScorePage
      title="Energy"
      question="How much physiological capacity do you have available right now?"
      color={DOMAIN_COLOR.energy}
      ringLabel="Energy"
      pick={(s) => s.energy}
      baselineLabel={(s) => `Your 14-day typical energy is ${s.baseline}. Sleep and recovery charge the battery; activity spends it.`}
      algoNote="Sleep quality, HRV and this morning's recovery charge the score; each counted activity draws it down in proportion to its load."
    />
  );
}
