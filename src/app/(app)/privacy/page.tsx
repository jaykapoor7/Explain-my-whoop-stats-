"use client";

import { Cpu, Database, ShieldCheck, Trash2, UserCheck } from "lucide-react";
import { useApp } from "@/lib/store";
import { Button, Card, FadeIn } from "@/components/ui";

const PRINCIPLES = [
  {
    icon: Cpu,
    title: "Local processing",
    body: "Your health exports and calendar files are parsed and analyzed entirely in your browser. The statistics engine, insight generation and chat answers all run on-device — there is no server-side processing of your health or schedule data.",
  },
  {
    icon: Database,
    title: "You own your data",
    body: "Data is stored only in this browser's local storage, on your device. There's no account, no cloud copy, and nothing to breach. Export files stay wherever you keep them.",
  },
  {
    icon: Trash2,
    title: "Delete everything, any time",
    body: "One click removes every imported record, experiment and conversation from this device. Deletion is immediate and complete — there's no server to purge.",
  },
  {
    icon: UserCheck,
    title: "Never used to train AI",
    body: "Your uploaded health data is not used to train AI models — full stop. If a future version offers optional cloud-model analysis, it will be off by default and require your explicit consent per request.",
  },
];

export default function PrivacyPage() {
  const clearAll = useApp((s) => s.clearAll);
  const meta = useApp((s) => s.meta);
  const hydrated = useApp((s) => s.hydrated);

  return (
    <div className="mx-auto max-w-3xl">
      <FadeIn>
        <span className="inline-flex items-center gap-2 rounded-full border border-status-good/25 bg-status-good/[0.07] px-4 py-1.5 text-xs font-medium text-[#6ee7b7]">
          <ShieldCheck size={13} /> Privacy is the product
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Your health data stays yours.</h1>
        <p className="mt-3 max-w-xl text-base-300">
          Health data is among the most sensitive data you have. Recovery Intelligence is built so
          that trusting us isn&apos;t required — the architecture does the promising.
        </p>
      </FadeIn>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {PRINCIPLES.map((p, i) => (
          <FadeIn key={p.title} delay={i * 0.06}>
            <Card className="h-full p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-good/12 text-[#6ee7b7]">
                <p.icon size={18} strokeWidth={1.8} />
              </span>
              <h3 className="mt-4 font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-base-300">{p.body}</p>
            </Card>
          </FadeIn>
        ))}
      </div>

      {hydrated && (
        <FadeIn delay={0.2}>
          <Card className="mt-8 flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-semibold">Delete all data from this device</h3>
              <p className="mt-1 text-sm text-base-400">
                {meta
                  ? `Currently stored: ${meta.source} (imported ${new Date(meta.importedAt).toLocaleDateString()}), plus any experiments and chat history.`
                  : "No data is currently stored."}
              </p>
            </div>
            <Button
              variant="danger"
              disabled={!meta}
              onClick={() => {
                if (confirm("Permanently delete all health data, experiments and chats from this device?")) clearAll();
              }}
            >
              <Trash2 size={14} /> Delete everything
            </Button>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
