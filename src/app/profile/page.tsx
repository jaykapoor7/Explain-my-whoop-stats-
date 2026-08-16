"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Cloud, Loader2, LogIn, LogOut, Settings as SettingsIcon } from "lucide-react";
import { useAccount } from "@/components/account";
import { Card, IconBadge, PageHeader, Section, SkeletonPage } from "@/components/ui";
import { useApp } from "@/lib/data/store";
import { ageFromBirthYear } from "@/lib/scoring/health-age";
import { cn } from "@/lib/format";

const FIELD = "h-11 w-full rounded-xl border border-black/10 bg-black/[0.02] px-3.5 text-sm text-ink-100 outline-none transition focus:border-black/25";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-500">{label}{hint && <span className="ml-1 normal-case text-ink-400">· {hint}</span>}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

/** The editable "About you" form — a real draft you Save, not always-live inputs.
 * Only mounted after hydration, so the draft initialises from the loaded values. */
function AboutYou() {
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const [draft, setDraft] = useState<{
    name: string; birthYear?: number; sex?: "male" | "female" | "other"; heightCm?: number; weightUnit: "kg" | "lb";
  }>({ name: settings.name ?? "", birthYear: settings.birthYear, sex: settings.sex, heightCm: settings.heightCm, weightUnit: settings.weightUnit });
  const [saved, setSaved] = useState(false);

  const dirty =
    draft.name !== (settings.name ?? "") || draft.birthYear !== settings.birthYear ||
    draft.sex !== settings.sex || draft.heightCm !== settings.heightCm || draft.weightUnit !== settings.weightUnit;

  const save = () => {
    setSettings({ name: draft.name.trim() || "You", birthYear: draft.birthYear, sex: draft.sex, heightCm: draft.heightCm, weightUnit: draft.weightUnit });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const age = ageFromBirthYear(draft.birthYear);

  return (
    <Card className="p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display name">
          <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className={FIELD} />
        </Field>
        <Field label="Birth year" hint={age ? `age ${age}` : "for Health Age"}>
          <input
            type="number" value={draft.birthYear ?? ""}
            onChange={(e) => { const y = parseInt(e.target.value, 10); setDraft((d) => ({ ...d, birthYear: Number.isFinite(y) ? y : undefined })); }}
            placeholder="e.g. 1998" className={cn(FIELD, "tabular")}
          />
        </Field>
        <Field label="Sex" hint="optional">
          <div className="flex overflow-hidden rounded-xl border border-black/[0.1] text-xs">
            {(["male", "female", "other"] as const).map((v) => (
              <button key={v} onClick={() => setDraft((d) => ({ ...d, sex: d.sex === v ? undefined : v }))}
                className={cn("flex-1 px-3 py-2.5 font-medium capitalize transition-colors", draft.sex === v ? "bg-ink-50 text-ink-950" : "text-ink-400 hover:text-ink-200")}>
                {v}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Height" hint="cm">
          <input
            type="number" value={draft.heightCm ?? ""}
            onChange={(e) => { const h = parseInt(e.target.value, 10); setDraft((d) => ({ ...d, heightCm: Number.isFinite(h) ? h : undefined })); }}
            placeholder="e.g. 178" className={cn(FIELD, "tabular")}
          />
        </Field>
        <Field label="Weight unit">
          <div className="flex overflow-hidden rounded-xl border border-black/[0.1] text-xs">
            {(["kg", "lb"] as const).map((u) => (
              <button key={u} onClick={() => setDraft((d) => ({ ...d, weightUnit: u }))}
                className={cn("flex-1 px-3 py-2.5 font-medium transition-colors", draft.weightUnit === u ? "bg-ink-50 text-ink-950" : "text-ink-400 hover:text-ink-200")}>
                {u}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3 border-t border-black/[0.05] pt-4">
        <span className="text-[11px] text-ink-400">{dirty ? "Unsaved changes" : "Your wake time lives on the Sleep coach."}</span>
        <button
          onClick={save}
          disabled={!dirty}
          className={cn("flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-semibold transition", dirty ? "bg-recovery text-[#241f18]" : "bg-black/[0.06] text-ink-400")}
        >
          {saved ? <><Check size={14} /> Saved</> : "Save profile"}
        </button>
      </div>
    </Card>
  );
}

export default function ProfilePage() {
  const { settings } = useApp();
  const account = useAccount();
  const hydrated = useApp((s) => s.hydrated);
  if (!hydrated) return <SkeletonPage />;

  const initial = (account.user?.name || account.user?.email || settings.name || "You").slice(0, 1).toUpperCase();

  return (
    <div className="animate-fadeUp">
      <PageHeader title="Profile" sub="Who you are — and the details that personalize your scores." />

      {/* Identity */}
      <Card className="tint mt-5 p-5" style={{ ["--accent" as string]: "#13b57e" }}>
        <div className="flex flex-wrap items-center gap-4">
          {account.user?.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={account.user.picture} alt="" className="h-16 w-16 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-recovery/20 text-2xl font-bold text-recovery">{initial}</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold text-ink-50">{settings.name || account.user?.name || "You"}</div>
            {account.signedIn ? (
              <>
                {account.user?.email && <div className="truncate text-xs text-ink-400">{account.user.email}</div>}
                <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-good">
                  {account.syncing ? <><Loader2 size={11} className="animate-spin" /> syncing…</> : <><Cloud size={11} /> synced across your devices</>}
                </div>
              </>
            ) : (
              <div className="text-xs text-ink-400">Not signed in — data stays on this device.</div>
            )}
          </div>
          {account.signedIn ? (
            <button onClick={() => account.signOut()} className="flex items-center gap-1.5 rounded-full border border-black/15 px-4 py-2 text-xs font-medium text-ink-200 hover:bg-black/[0.05]"><LogOut size={13} /> Sign out</button>
          ) : (
            <button onClick={account.signIn} className="flex items-center gap-2 rounded-full bg-recovery px-4 py-2 text-xs font-semibold text-[#241f18]"><LogIn size={14} /> Sign in</button>
          )}
        </div>
      </Card>

      <Section title="About you" sub="Used to personalize Health Age and your units. Save to apply." accent="#13b57e">
        <AboutYou />
      </Section>

      <Link href="/settings" className="group mt-4 block">
        <Card className="card-interactive flex items-center gap-3 p-4">
          <IconBadge color="#83765f" size={36}><SettingsIcon size={16} /></IconBadge>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-ink-100">Settings</div>
            <div className="text-[11px] text-ink-400">Connections, data controls, privacy and the Lock Screen widget</div>
          </div>
          <span className="text-ink-400">→</span>
        </Card>
      </Link>

      <p className="mt-8 text-center text-[11px] text-ink-500">
        CURA · not a medical device ·{" "}
        <Link href="/privacy" className="hover:text-ink-300">Privacy</Link> ·{" "}
        <Link href="/terms" className="hover:text-ink-300">Terms</Link>
      </p>
    </div>
  );
}
