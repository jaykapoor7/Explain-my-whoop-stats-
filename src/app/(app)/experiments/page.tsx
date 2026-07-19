"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, FlaskConical, Minus, Plus, Trash2, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { RequireData } from "@/components/require-data";
import { Badge, Button, Card, FadeIn } from "@/components/ui";
import { analyzeExperiment, EXPERIMENT_TEMPLATES } from "@/lib/experiments";
import { Experiment, METRICS, MetricKey, METRIC_LIST } from "@/lib/types";
import { fmt } from "@/lib/stats";
import { cn, formatDate, uid } from "@/lib/utils";

function NewExperimentForm({ onClose }: { onClose: () => void }) {
  const addExperiment = useApp((s) => s.addExperiment);
  const days = useApp((s) => s.days);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(days[Math.max(0, days.length - 15)]?.date ?? "");
  const [metrics, setMetrics] = useState<MetricKey[]>(["recovery", "hrv"]);

  const toggle = (k: MetricKey) =>
    setMetrics((m) => (m.includes(k) ? m.filter((x) => x !== k) : m.length < 4 ? [...m, k] : m));

  const usable = METRIC_LIST.filter((m) => days.some((d) => d[m.key] !== undefined));

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
      <Card className="mb-4 border-accent/25">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">New experiment</h3>
          <button onClick={onClose} className="text-base-400 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-base-400">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. No caffeine after lunch"
              className="h-10 w-full rounded-lg border border-white/10 bg-base-900 px-3 text-sm outline-none focus:border-accent/60"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-base-400">Start date</label>
            <input
              type="date"
              value={startDate}
              min={days[0]?.date}
              max={days[days.length - 1]?.date}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 w-full rounded-lg border border-white/10 bg-base-900 px-3 text-sm outline-none focus:border-accent/60 [color-scheme:dark]"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-base-400">What are you changing?</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the protocol"
              className="h-10 w-full rounded-lg border border-white/10 bg-base-900 px-3 text-sm outline-none focus:border-accent/60"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-base-400">
              Metrics to watch (up to 4)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {usable.map((m) => (
                <button
                  key={m.key}
                  onClick={() => toggle(m.key)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition",
                    metrics.includes(m.key) ? "bg-accent text-white" : "border border-white/10 text-base-300 hover:bg-white/[0.06]"
                  )}
                >
                  {m.shortLabel}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!name.trim() || !startDate || !metrics.length}
            onClick={() => {
              addExperiment({
                id: uid(),
                name: name.trim(),
                description: description.trim(),
                startDate,
                targetMetrics: metrics,
                createdAt: new Date().toISOString(),
              });
              onClose();
            }}
          >
            Start experiment
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

function ExperimentCard({ exp }: { exp: Experiment }) {
  const days = useApp((s) => s.days);
  const removeExperiment = useApp((s) => s.removeExperiment);
  const analysis = useMemo(() => analyzeExperiment(exp, days), [exp, days]);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical size={15} className="text-accent-soft" />
            <h3 className="font-semibold">{exp.name}</h3>
          </div>
          {exp.description && <p className="mt-1 text-xs text-base-400">{exp.description}</p>}
          <p className="mt-1 text-xs text-base-400">
            Started {formatDate(exp.startDate, { month: "long", day: "numeric" })}
            {analysis ? ` · ${analysis.daysRunning} days in` : ""}
          </p>
        </div>
        <button
          onClick={() => {
            if (confirm(`Delete experiment "${exp.name}"?`)) removeExperiment(exp.id);
          }}
          className="text-base-400 transition hover:text-[#ffa2b0]"
          aria-label="Delete experiment"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {analysis && (
        <>
          {analysis.results.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {analysis.results.map((r) => {
                const meta = METRICS[r.metric];
                const Icon = r.verdict === "improved" ? ArrowUp : r.verdict === "declined" ? ArrowDown : Minus;
                return (
                  <div key={r.metric} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-base-300">{meta.label}</span>
                      <Badge tone={r.verdict === "improved" ? "good" : r.verdict === "declined" ? "critical" : "neutral"}>
                        <Icon size={11} />
                        {r.verdict === "no-change" ? "no clear change" : r.verdict}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2 tabular">
                      <span className="text-xs text-base-400">{fmt(r.before, meta.decimals)}{meta.unit}</span>
                      <span className="text-xs text-base-400">→</span>
                      <span className="text-base font-semibold">{fmt(r.after, meta.decimals)}{meta.unit}</span>
                      <span className={cn("text-xs", r.diff > 0 ? "text-[#6ee7b7]" : r.diff < 0 ? "text-[#ffa2b0]" : "text-base-400")}>
                        {r.diff >= 0 ? "+" : ""}{fmt(r.diff, meta.decimals)}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-base-400">
                      {r.nBefore}d before vs {r.nAfter}d after · d = {fmt(Math.abs(r.d), 2)} · p ≈ {r.p < 0.001 ? "<0.001" : fmt(r.p, 3)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-4 text-sm leading-relaxed text-base-200">{analysis.summary}</p>
          {analysis.caveat && <p className="mt-2 text-xs leading-relaxed text-base-400">{analysis.caveat}</p>}
        </>
      )}
    </Card>
  );
}

function ExperimentsBody() {
  const experiments = useApp((s) => s.experiments);
  const addExperiment = useApp((s) => s.addExperiment);
  const days = useApp((s) => s.days);
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Experiment Mode</h1>
          <p className="mt-1 text-sm text-base-400">
            Change one thing, then let the data judge it: before/after comparison with honest effect sizes.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={14} /> New experiment
        </Button>
      </div>

      <div className="mt-6">
        <AnimatePresence>{creating && <NewExperimentForm onClose={() => setCreating(false)} />}</AnimatePresence>

        <div className="space-y-3">
          {experiments.map((exp) => (
            <FadeIn key={exp.id}>
              <ExperimentCard exp={exp} />
            </FadeIn>
          ))}
        </div>

        {!experiments.length && !creating && (
          <Card className="py-8 text-center">
            <FlaskConical size={22} className="mx-auto text-base-400" />
            <p className="mt-3 text-sm text-base-300">No experiments yet. Start from a template:</p>
            <div className="mx-auto mt-4 grid max-w-2xl gap-2 sm:grid-cols-2">
              {EXPERIMENT_TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() =>
                    addExperiment({
                      id: uid(),
                      name: t.name,
                      description: t.description,
                      startDate: days[Math.max(0, days.length - 15)]?.date ?? days[0].date,
                      targetMetrics: t.metrics.filter((m) => days.some((d) => d[m] !== undefined)),
                      createdAt: new Date().toISOString(),
                    })
                  }
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-3 text-left transition hover:border-accent/40 hover:bg-accent/[0.06]"
                >
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="mt-0.5 text-xs text-base-400">{t.description}</div>
                </button>
              ))}
            </div>
            <p className="mx-auto mt-4 max-w-md text-xs text-base-400">
              Templates start 2 weeks ago so you can see the analysis flow immediately — edit the start date to match
              when you actually began.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function ExperimentsPage() {
  return (
    <RequireData>
      <ExperimentsBody />
    </RequireData>
  );
}
