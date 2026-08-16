"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Cloud, Info, LogIn, LogOut, Loader2, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { FitbitCard } from "@/components/connect";
import { Connections } from "@/components/connections";
import { useAccount } from "@/components/account";
import { Card, PageHeader, Section, SkeletonPage } from "@/components/ui";
import { useApp } from "@/lib/data/store";
import { cn } from "@/lib/format";

/** A left-label / right-control settings row with a divider. */
function Row({ label, hint, children, last }: { label: string; hint?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3.5", !last && "border-b border-black/[0.05]")}>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink-100">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] leading-relaxed text-ink-400">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn("h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors", on ? "bg-recovery" : "bg-black/15")}
    >
      <span className={cn("block h-5 w-5 rounded-full bg-white shadow-sm transition-transform", on && "translate-x-5")} />
    </button>
  );
}

export default function SettingsPage() {
  const { settings, setSettings, resetAll, hydrated } = useApp();
  const account = useAccount();
  const [notice, setNotice] = useState<{ kind: "setup" | "error" } | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const f = p.get("fitbit");
    if (f === "setup" || f === "error") {
      setNotice({ kind: f });
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  if (!hydrated) return <SkeletonPage />;

  return (
    <div className="animate-fadeUp">
      <PageHeader back title="Settings" sub="Your profile, connected data and privacy — all in one place." />

      {notice?.kind === "setup" && (
        <Card className="mt-5 flex items-start gap-3 border border-warn/25 bg-warn/[0.06] p-4">
          <Info size={17} className="mt-0.5 shrink-0 text-warn" />
          <p className="text-[13px] leading-relaxed text-ink-200">
            We couldn&apos;t start sign-in just now. Please try again in a moment.
          </p>
        </Card>
      )}
      {notice?.kind === "error" && (
        <Card className="mt-5 flex items-start gap-3 border border-bad/25 bg-bad/[0.06] p-4">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-bad" />
          <p className="text-[13px] leading-relaxed text-ink-200">Sign-in didn&apos;t complete. Please try again.</p>
        </Card>
      )}

      <Section title="Account" sub="One profile, synced across your laptop and phone.">
        <Card className="p-5">
          {account.signedIn ? (
            <div className="flex flex-wrap items-center gap-3.5">
              {account.user?.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={account.user.picture} alt="" className="h-11 w-11 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-recovery/20 text-base font-bold text-recovery">{(account.user?.name || account.user?.email || "You").slice(0, 1).toUpperCase()}</span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink-50">{account.user?.name || "Signed in"}</div>
                {account.user?.email && <div className="truncate text-xs text-ink-400">{account.user.email}</div>}
                <div className={cn("mt-1 flex items-center gap-1 text-[11px] font-medium", account.syncError || !account.syncDurable ? "text-warn" : "text-good")}>
                  {account.syncing ? <><Loader2 size={11} className="animate-spin" /> syncing…</>
                    : account.syncError ? <><AlertTriangle size={11} /> sync error — try again shortly</>
                    : !account.syncDurable ? <><AlertTriangle size={11} /> sync unavailable right now</>
                    : <><Cloud size={11} /> synced across your devices</>}
                </div>
              </div>
              <button onClick={() => account.signOut()} className="flex items-center gap-1.5 rounded-full border border-black/15 px-4 py-2 text-xs font-medium text-ink-200 hover:bg-black/[0.05]"><LogOut size={13} /> Sign out</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] leading-relaxed text-ink-400">Sign in with Google to use CURA on your laptop and phone with everything in sync — your data, connection and friends follow you.</p>
              <button onClick={account.signIn} className="flex shrink-0 items-center gap-2 rounded-full bg-recovery px-5 py-2.5 text-xs font-semibold text-[#241f18]"><LogIn size={14} /> Sign in with Google</button>
            </div>
          )}
        </Card>
      </Section>

      <Section title="Profile & preferences">
        <Card className="px-5 py-1">
          <Link href="/profile" className="group -mx-1 flex items-center justify-between gap-4 border-b border-black/[0.05] px-1 py-3.5">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-ink-100">Your profile</div>
              <div className="mt-0.5 text-[11px] text-ink-400">Name, birth year, sex, height and weight unit</div>
            </div>
            <span className="shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
          <Row label="Show unrecognized HR blocks on Strain" hint="Short elevated-HR spikes that aren't clearly a workout." last>
            <Toggle on={settings.showLowConfidence} onClick={() => setSettings({ showLowConfidence: !settings.showLowConfidence })} label="Toggle low-confidence visibility" />
          </Row>
        </Card>
      </Section>

      <Section title="Connected wearable" sub="Sign in with Google to connect your Fitbit / Google Health data.">
        <FitbitCard autoSyncOnConnected />
      </Section>

      <Section title="Other wearables" sub="Connect Oura, WHOOP or Polar directly — CURA syncs and scores them the same way.">
        <Connections />
      </Section>

      <Section title="Privacy">
        <Card className="flex items-start gap-3.5 p-5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-good/10 text-good">
            <ShieldCheck size={17} />
          </span>
          <p className="text-[13px] leading-relaxed text-ink-400">
            When you&apos;re signed in, your data is stored in your own account so it syncs across your devices; signed
            out, it stays only in this browser. Medication and journal data are treated as sensitive — never used for
            advertising or to train models — and your Google token is encrypted at rest. See our{" "}
            <Link href="/privacy" className="text-recovery underline">Privacy Policy</Link>.
          </p>
        </Card>
      </Section>

      <Section title="Your data">
        <Card className="px-5 py-1">
          <Row label="Reset local data" hint="Clears synced wearable data, logs and preferences from this device." last={!account.signedIn}>
            <button
              onClick={() => { if (confirm("Clear all local logs, edits and preferences?")) resetAll(); }}
              className="flex items-center gap-1.5 rounded-full border border-black/15 px-4 py-2 text-xs font-semibold text-ink-200 transition hover:bg-black/[0.05]"
            >
              <RotateCcw size={13} /> Reset
            </button>
          </Row>
          {account.signedIn && (
            <Row label="Delete account" hint="Permanently erases your profile, connection and cloud data everywhere." last>
              <button
                onClick={() => { if (confirm("Permanently delete your account and all cloud data? This cannot be undone.")) account.deleteAccount(); }}
                className="flex items-center gap-1.5 rounded-full border border-bad/40 bg-bad/[0.08] px-4 py-2 text-xs font-semibold text-bad transition hover:bg-bad/15"
              >
                <Trash2 size={13} /> Delete
              </button>
            </Row>
          )}
        </Card>
      </Section>

      <p className="mt-10 text-center text-[11px] text-ink-500">
        CURA · not a medical device ·{" "}
        <Link href="/privacy" className="hover:text-ink-300">Privacy</Link> ·{" "}
        <Link href="/terms" className="hover:text-ink-300">Terms</Link>
      </p>
    </div>
  );
}
