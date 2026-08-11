"use client";

import { Check, Clock, Pill, ShieldAlert, X } from "lucide-react";
import { Card, PageHeader, ProgressBar, Section, SkeletonPage, StatusPill, Why } from "@/components/ui";
import { useHealth } from "@/lib/data/use-health";
import { useOverlay } from "@/lib/data/store";
import { cn, fmtDate, fmtNum, fmtTime } from "@/lib/format";
import { MedStatus } from "@/lib/types";

const ACCENT = "#e089d2";

const STATUS_META: Record<MedStatus, { label: string; color: string }> = {
  taken: { label: "Taken", color: "#38d39f" },
  delayed: { label: "Delayed", color: "#f6b83b" },
  skipped: { label: "Skipped", color: "#ff6b6b" },
  pending: { label: "Pending", color: "#6b7482" },
};

export default function MedicationPage() {
  const data = useHealth();
  const setMedStatus = useOverlay((s) => s.setMedStatus);
  if (!data.hydrated) return <SkeletonPage />;

  const meds = data.dataset.medications;
  const t = data.today;
  const last30 = data.days.slice(-30);
  const events30 = last30.flatMap((s) => s.day.medicationEvents).filter((e) => e.status !== "pending");
  const adherence = events30.length ? Math.round((events30.filter((e) => e.status === "taken").length / events30.length) * 100) : 0;

  const medInsights = data.insights.filter((i) => i.domain === "medication");

  return (
    <div className="animate-fadeUp">
      <PageHeader title="Medication" sub="Schedule, adherence, and history — treated as sensitive data." />

      <Card className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <span className="tabular text-3xl font-bold text-ink-50">{adherence}%</span>
            <span className="ml-1.5 text-sm text-ink-400">30-day adherence</span>
          </div>
          <span className="text-xs text-ink-400">{events30.filter((e) => e.status === "taken").length} of {events30.length} doses taken</span>
        </div>
        <div className="mt-3">
          <ProgressBar value={adherence} max={100} color={ACCENT} />
        </div>
      </Card>

      <Section title="Today's schedule">
        <div className="space-y-3">
          {t.day.medicationEvents.map((e) => {
            const med = meds.find((m) => m.id === e.medicationId)!;
            const meta = STATUS_META[e.status];
            return (
              <Card key={e.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${ACCENT}1a`, color: ACCENT }}>
                    <Pill size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink-100">
                      {med.name} <span className="ml-1 text-xs font-normal text-ink-400">{med.dose}</span>
                    </div>
                    <div className="text-[11px] text-ink-400">
                      {e.scheduled ? `Scheduled ${fmtTime(e.scheduled)}` : "As needed"} · {med.withFood === "with" ? "with food" : med.withFood === "without" ? "without food" : "with or without food"}
                      {e.takenAt && e.status !== "skipped" ? ` · logged ${fmtTime(e.takenAt)}` : ""}
                    </div>
                  </div>
                  <StatusPill text={meta.label} color={meta.color} />
                </div>
                <div className="mt-3 flex gap-2">
                  {(
                    [
                      ["taken", Check, "Taken"],
                      ["delayed", Clock, "Delayed"],
                      ["skipped", X, "Skipped"],
                    ] as const
                  ).map(([status, Icon, label]) => (
                    <button
                      key={status}
                      onClick={() =>
                        setMedStatus(e.id, status, status === "skipped" ? undefined : new Date().toTimeString().slice(0, 5))
                      }
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                        e.status === status ? "border-transparent bg-white/[0.12] text-ink-50" : "border-white/12 text-ink-300 hover:bg-white/[0.06]"
                      )}
                    >
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      <Section title="Your medications">
        <div className="grid gap-3 sm:grid-cols-2">
          {meds.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="text-sm font-semibold text-ink-100">{m.name}</div>
              <div className="mt-1 text-xs text-ink-400">
                {m.dose} · {m.frequency === "as-needed" ? "as needed" : `${m.times.map(fmtTime).join(", ")}`}
              </div>
              {m.notes && <div className="mt-1.5 text-xs text-ink-500">{m.notes}</div>}
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Last 14 days" sub="Dose history">
        <Card className="overflow-x-auto p-4">
          <div className="flex min-w-[420px] gap-1.5">
            {data.days.slice(-14).map((s) => {
              const evts = s.day.medicationEvents.filter((e) => e.status !== "pending");
              const taken = evts.filter((e) => e.status === "taken").length;
              const frac = evts.length ? taken / evts.length : 0;
              return (
                <div key={s.day.date} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className="h-14 w-full rounded-md"
                    style={{ background: `${ACCENT}${frac === 1 ? "cc" : frac >= 0.5 ? "66" : "26"}` }}
                    title={`${taken}/${evts.length} taken`}
                  />
                  <span className="text-[9px] text-ink-500">{fmtDate(s.day.date, { day: "numeric" })}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </Section>

      {medInsights.length > 0 && (
        <Section title="Observed associations" sub="Observational only — never medical advice">
          <div className="space-y-3">
            {medInsights.map((i) => (
              <Card key={i.id} className="p-4">
                <p className="text-sm font-medium text-ink-100">{i.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-400">{i.detail}</p>
                <p className="mt-1.5 text-[10px] text-ink-500">n = {fmtNum(i.n)} days</p>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Card className="mt-8 flex items-start gap-3 border-white/[0.08] p-4">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-ink-400" />
        <p className="text-xs leading-relaxed text-ink-400">
          This app never recommends starting, stopping, or changing any medication or dose. Associations shown are
          observational patterns in your own logs. Discuss anything concerning with your doctor or pharmacist.
        </p>
      </Card>
      <div className="mt-4">
        <Why summary="How is this data handled?">
          Medication data stays on your device in this build. When sync is added it will be end-to-end encrypted and
          excluded from any analytics by default.
        </Why>
      </div>
    </div>
  );
}
