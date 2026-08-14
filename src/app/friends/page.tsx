"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, LogIn, LogOut, Plus, Trophy, Users } from "lucide-react";
import { Card, PageHeader, Section, SkeletonPage } from "@/components/ui";
import { useAccount } from "@/components/account";
import { useHealth } from "@/lib/data/use-health";
import { DOMAIN_COLOR, cn } from "@/lib/format";

interface MemberScore {
  sub: string; name?: string; picture?: string;
  recovery: number | null; sleep: number | null; strain: number | null; sleepHours: number | null; day: string;
}
interface Group { id: string; name: string; code: string; ownerSub: string; isOwner: boolean; members: MemberScore[]; }

type Metric = "recovery" | "sleep" | "strain";
const METRICS: { key: Metric; label: string; color: string; fmt: (m: MemberScore) => string; val: (m: MemberScore) => number | null; sub?: (m: MemberScore) => string }[] = [
  { key: "recovery", label: "Recovery", color: DOMAIN_COLOR.recovery, val: (m) => m.recovery, fmt: (m) => (m.recovery == null ? "—" : `${m.recovery}%`) },
  { key: "sleep", label: "Sleep", color: DOMAIN_COLOR.sleep, val: (m) => m.sleep, fmt: (m) => (m.sleep == null ? "—" : `${m.sleep}`), sub: (m) => (m.sleepHours != null ? `${m.sleepHours.toFixed(1)}h` : "") },
  { key: "strain", label: "Strain", color: DOMAIN_COLOR.strain, val: (m) => m.strain, fmt: (m) => (m.strain == null ? "—" : m.strain.toFixed(1)) },
];

const MEDAL = ["#f4c04e", "#c7c7cf", "#d69a6a"];

function initials(n?: string) { return (n || "?").trim().slice(0, 1).toUpperCase(); }

function Leaderboard({ group, metric, meSub }: { group: Group; metric: Metric; meSub: string }) {
  const spec = METRICS.find((m) => m.key === metric)!;
  const ranked = [...group.members].sort((a, b) => {
    const va = spec.val(a), vb = spec.val(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return vb - va; // higher is better (incl. strain = most load)
  });
  return (
    <div className="space-y-2">
      {ranked.map((m, i) => {
        const v = spec.val(m);
        const rank = v == null ? null : i + 1;
        const isMe = m.sub === meSub;
        return (
          <div key={m.sub} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5", isMe ? "bg-black/[0.04]" : "hover:bg-black/[0.02]")}>
            <span className="tabular w-6 shrink-0 text-center text-sm font-bold" style={{ color: rank && rank <= 3 ? MEDAL[rank - 1] : "#9a8f78" }}>
              {rank ?? "–"}
            </span>
            {m.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.picture} alt="" className="h-8 w-8 shrink-0 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: `${spec.color}22`, color: spec.color }}>{initials(m.name)}</span>
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-100">{m.name || "Member"}{isMe && <span className="ml-1.5 text-[11px] font-normal text-ink-500">you</span>}</span>
            <div className="text-right">
              <div className="tabular text-sm font-bold" style={{ color: spec.color }}>{spec.fmt(m)}</div>
              {spec.sub && spec.sub(m) && <div className="text-[10px] text-ink-500">{spec.sub(m)}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GroupCard({ group, meSub, onLeave }: { group: Group; meSub: string; onLeave: (id: string) => void }) {
  const [metric, setMetric] = useState<Metric>("recovery");
  const [copied, setCopied] = useState(false);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/[0.05] text-ink-300"><Users size={16} /></span>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-ink-50">{group.name}</div>
          <div className="text-[11px] text-ink-500">{group.members.length} member{group.members.length === 1 ? "" : "s"}</div>
        </div>
        <button
          onClick={() => { navigator.clipboard?.writeText(group.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="tabular ml-auto flex items-center gap-1.5 rounded-full border border-black/[0.1] px-3 py-1.5 text-xs font-semibold tracking-wide text-ink-200 hover:bg-black/[0.04]"
          title="Copy invite code"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />} {group.code}
        </button>
        <button onClick={() => onLeave(group.id)} className="rounded-full border border-black/[0.1] p-2 text-ink-400 hover:text-bad" title="Leave group"><LogOut size={13} /></button>
      </div>

      <div className="mt-4 flex gap-1 rounded-xl bg-black/[0.03] p-1">
        {METRICS.map((m) => (
          <button key={m.key} onClick={() => setMetric(m.key)} className={cn("flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors", metric === m.key ? "bg-white text-ink-50 shadow-sm" : "text-ink-400")}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <Leaderboard group={group} metric={metric} meSub={meSub} />
      </div>
    </Card>
  );
}

export default function FriendsPage() {
  const account = useAccount();
  const data = useHealth();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fetchGroups = useCallback(async () => {
    const r = await fetch("/api/social/groups", { cache: "no-store" }).catch(() => null);
    if (r?.ok) setGroups(((await r.json()) as { groups: Group[] }).groups);
    else setGroups([]);
  }, []);

  // Publish my latest scores so groups can rank me, then load groups.
  const t = data.today;
  useEffect(() => {
    if (!account.signedIn) return;
    (async () => {
      if (t) {
        await fetch("/api/social/publish", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recovery: t.recovery.available === false ? null : Math.round(t.recovery.score),
            sleep: t.sleep.available === false ? null : Math.round(t.sleep.score),
            strain: t.strain.available === false ? null : Math.round(t.strain.score * 10) / 10,
            sleepHours: t.day.sleep.asleepMin > 0 ? Math.round((t.day.sleep.asleepMin / 60) * 10) / 10 : null,
            day: t.day.date,
          }),
        }).catch(() => {});
      }
      fetchGroups();
    })();
  }, [account.signedIn, t, fetchGroups]);

  const meSub = account.user?.sub ?? "";

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true); setError("");
    const r = await fetch("/api/social/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) }).catch(() => null);
    setBusy(false);
    if (r?.ok) { setName(""); fetchGroups(); } else setError("Couldn't create the group.");
  };
  const join = async () => {
    if (!code.trim()) return;
    setBusy(true); setError("");
    const r = await fetch("/api/social/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.trim() }) }).catch(() => null);
    setBusy(false);
    if (r?.ok) { setCode(""); fetchGroups(); }
    else setError(r?.status === 404 ? "No group found with that code." : "Couldn't join.");
  };
  const leave = async (id: string) => {
    if (!confirm("Leave this group?")) return;
    await fetch("/api/social/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: id }) }).catch(() => {});
    fetchGroups();
  };

  const field = "h-11 w-full rounded-xl border border-black/10 bg-black/[0.02] px-3.5 text-sm text-ink-100 outline-none focus:border-black/25";

  if (account.loading) return <SkeletonPage />;

  if (!account.signedIn) {
    return (
      <div className="animate-fadeUp">
        <PageHeader title="Friends" sub="Form a group and compete on recovery, sleep and strain — on any wearable." />
        <Card className="mt-5 p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-recovery/12 text-recovery"><Trophy size={22} /></span>
          <h3 className="mt-4 font-display text-lg font-bold text-ink-50">Sign in to compete</h3>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-400">
            Friend groups sync through your account. Because everyone is scored by the same engine, a Fitbit, a Pixel
            Watch or a manual logger can all go head-to-head — cross-platform.
          </p>
          <button onClick={account.signIn} className="mt-5 inline-flex items-center gap-2 rounded-full bg-recovery px-6 py-3 text-sm font-semibold text-[#241f18]"><LogIn size={16} /> Sign in with Google</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fadeUp">
      <PageHeader title="Friends" sub="Form a group and compete on recovery, sleep and strain — cross-platform." />

      {/* Create / join */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="text-[13px] font-semibold text-ink-100">Create a group</div>
          <div className="mt-2.5 flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="Group name" className={field} />
            <button onClick={create} disabled={busy || !name.trim()} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-recovery px-4 text-xs font-semibold text-[#241f18] disabled:opacity-40"><Plus size={14} /> Create</button>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[13px] font-semibold text-ink-100">Join with a code</div>
          <div className="mt-2.5 flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && join()} placeholder="6-character code" maxLength={6} className={cn(field, "tabular uppercase tracking-widest")} />
            <button onClick={join} disabled={busy || !code.trim()} className="shrink-0 rounded-xl border border-black/15 px-4 text-xs font-semibold text-ink-200 hover:bg-black/[0.05] disabled:opacity-40">Join</button>
          </div>
        </Card>
      </div>
      {error && <p className="mt-2 text-xs text-bad">{error}</p>}

      {groups === null ? (
        <div className="skeleton mt-5 h-64 rounded-2xl" />
      ) : groups.length === 0 ? (
        <Card className="mt-5 p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] text-ink-400"><Users size={22} /></span>
          <h3 className="mt-4 font-display text-lg font-bold text-ink-50">No groups yet</h3>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-400">Create a group and share its code with friends, or join one with a code they send you.</p>
        </Card>
      ) : (
        <Section title="Your groups" sub="Only your three headline scores are shared — nothing else.">
          <div className="space-y-4">
            {groups.map((g) => <GroupCard key={g.id} group={g} meSub={meSub} onLeave={leave} />)}
          </div>
        </Section>
      )}
    </div>
  );
}
