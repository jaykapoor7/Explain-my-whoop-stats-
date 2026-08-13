"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, Smartphone, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui";
import { useApp } from "@/lib/data/store";
import { syncWearable } from "@/lib/data/provider";

type Phase = "linking" | "syncing" | "done" | "error";

function PairInner() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code");
  const setWearableDays = useApp((s) => s.setWearableDays);
  const [phase, setPhase] = useState<Phase>("linking");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code) { setPhase("error"); setDetail("This link is missing its pairing code."); return; }
      const r = await fetch("/api/fitbit/pair/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }).catch(() => null);
      if (cancelled) return;
      if (!r?.ok) {
        setPhase("error");
        setDetail(r?.status === 410 ? "This pairing code has expired or was already used. Generate a fresh one on your other device." : "Couldn't link this device.");
        return;
      }
      setPhase("syncing");
      try {
        const res = await syncWearable();
        if (cancelled) return;
        setWearableDays(res.days, res.syncedAt);
        setDetail(`Pulled ${res.count} days.`);
      } catch {
        // Connection is linked even if the first sync hiccups.
      }
      if (cancelled) return;
      setPhase("done");
      setTimeout(() => router.replace("/today"), 1200);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className="mx-auto mt-16 max-w-sm animate-fadeUp">
      <Card className="p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-recovery/12 text-recovery">
          {phase === "error" ? <TriangleAlert size={22} /> : phase === "done" ? <CheckCircle2 size={22} /> : <Smartphone size={22} />}
        </span>
        <h1 className="mt-4 font-display text-lg font-bold text-ink-50">
          {phase === "linking" && "Linking this device…"}
          {phase === "syncing" && "Pulling your data…"}
          {phase === "done" && "You're all set"}
          {phase === "error" && "Couldn't link"}
        </h1>
        <p className="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-ink-400">
          {phase === "linking" && "Bringing your Fitbit connection over from your other device."}
          {phase === "syncing" && "Your connection is on this device — fetching your recent history."}
          {phase === "done" && (detail || "Taking you to your dashboard.")}
          {phase === "error" && detail}
        </p>
        {(phase === "linking" || phase === "syncing") && (
          <Loader2 size={18} className="mx-auto mt-4 animate-spin text-ink-400" />
        )}
        {phase === "error" && (
          <Link href="/settings" className="mt-4 inline-block rounded-full bg-recovery px-4 py-2 text-xs font-semibold text-[#241f18]">
            Go to connect
          </Link>
        )}
      </Card>
    </div>
  );
}

export default function PairPage() {
  return (
    <Suspense fallback={<div className="mx-auto mt-16 max-w-sm text-center text-sm text-ink-400">Loading…</div>}>
      <PairInner />
    </Suspense>
  );
}
