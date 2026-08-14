"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Smartphone } from "lucide-react";
import { Card } from "@/components/ui";
import { useAccount } from "@/components/account";
import { cn } from "@/lib/format";

/**
 * Reveals a personal widget token + endpoint for the CURA iOS Lock Screen
 * widget. The token is a read-only bearer credential for THIS account; the
 * widget uses it to fetch your latest Recovery / Energy / Sleep.
 */
export function WidgetSetup() {
  const { signedIn, signIn } = useAccount();
  const [state, setState] = useState<{ token: string; summaryUrl: string; appUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    const r = await fetch("/api/widget/token", { method: "POST" }).catch(() => null);
    if (r?.ok) setState((await r.json()) as { token: string; summaryUrl: string; appUrl: string });
    setBusy(false);
  };

  const copy = (label: string, value: string) => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    });
  };

  if (!signedIn) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-[13px] leading-relaxed text-ink-400">Sign in to generate a private token for your iPhone Lock Screen widget.</p>
        <button onClick={signIn} className="shrink-0 rounded-full bg-recovery px-4 py-2 text-xs font-semibold text-[#241f18]">Sign in</button>
      </Card>
    );
  }

  const Field = ({ label, value }: { label: string; value: string }) => (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-500">{label}</div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-black/[0.08] bg-black/[0.03] px-3 py-2 text-[12px] text-ink-200">{value}</code>
        <button onClick={() => copy(label, value)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-black/15 px-3 py-2 text-xs font-medium text-ink-200 hover:bg-black/[0.05]">
          {copied === label ? <><Check size={13} className="text-good" /> Copied</> : <><Copy size={13} /> Copy</>}
        </button>
      </div>
    </div>
  );

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3.5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-recovery/10 text-recovery"><Smartphone size={17} /></span>
        <p className="text-[13px] leading-relaxed text-ink-400">
          Put your Recovery, Energy and Sleep on your iPhone Lock Screen. Generate a private token, paste it into the CURA
          widget in Xcode, and install it on your phone. Build steps are in <code className="text-ink-200">ios/CuraLockWidget/README.md</code>.
        </p>
      </div>

      {!state ? (
        <button onClick={generate} disabled={busy} className="mt-4 flex items-center gap-2 rounded-full bg-recovery px-5 py-2.5 text-xs font-semibold text-[#241f18] disabled:opacity-60">
          {busy ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : "Generate widget token"}
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <Field label="Widget token" value={state.token} />
          <Field label="Summary URL" value={state.summaryUrl} />
          <p className={cn("text-[11px] leading-relaxed text-ink-500")}>
            Keep this token private — anyone with it can read your latest scores. It has no write access and expires only if
            the app secret is rotated.
          </p>
        </div>
      )}
    </Card>
  );
}
