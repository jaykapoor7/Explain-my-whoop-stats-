"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, LogIn, LogOut, Plus, Share2, Trophy, Users } from "lucide-react";
import { Card, PageHeader, Section, SegmentedControl, SkeletonPage } from "@/components/ui";
import { useAccount } from "@/components/account";
import { useHealth } from "@/lib/data/use-health";
import { DOMAIN_COLOR, cn } from "@/lib/format";
import { ScoredDay } from "@/lib/scoring/engine";

interface MemberScore {
  sub: string; name?: string; picture?: string;
  recovery: number | null; sleep: number | null; strain: number | null; sleepHours: number | null; day: string;
  recovery7: number | null; sleep7: number | null; strain7: number | null;
}
interface Group { id: string; name: string; code: string; ownerSub: string; isOwner: boolean; members: MemberScore[]; }

type Metric = "recovery" | "sleep" | "strain";
type Period = "today" | "week";

const METRICS: { key: Metric; label: string; color: string; today: (m: MemberScore) => number | null; week: (m: MemberScore) => number | null; fmt: (v: number) => string }[] = [
  { key: "recovery", label: "Recovery", color: DOMAIN_COLOR.recovery, today: (m) => m.recovery, week: (m) => m.recovery7, fmt: (v) => `${Math.round(v)}%` },
  { key: "sleep", label: "Sleep", color: DOMAIN_COLOR.sleep, today: (m) => m.sleep, week: (m) => m.sleep7, fmt: (v) => `${Math.round(v)}` },
  { key: "strain", label: "Strain", color: DOMAIN_COLOR.strain, today: (m) => m.strain, week: (m) => m.strain7, fmt: (v) => v.toFixed(1) },
];
const val = (spec: (typeof METRICS)[number], m: MemberScore, p: Period) => (p === "week" ? spec.week(m) : spec.today(m));

const MEDAL = ["#f4c04e", "#c7c7cf", "#d69a6a"];
const initials = (n?: string) => (n || "?").trim().slice(0, 1).toUpperCase();

function rankMembers(members: MemberScore[], spec: (typeof METRICS)[number], p: Period) {
  return [...members].sort((a, b) => {
    const va = val(spec, a, p), vb = val(spec, b, p);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return vb - va;
  });
}

/** The best "you're #1" standing this week, for the nudge. */
function topStanding(groups: Group[], meSub: string): { group: string; metric: string } | null {
  for (const g of groups) {
    if (g.members.length < 2) continue;
    for (const spec of METRICS) {
      const ranked = rankMembers(g.members, spec, "week");
      const top = ranked[0];
      if (top && top.sub === meSub && val(spec, top, "week") != null) return { group: g.name, metric: spec.label.toLowerCase() };
    }
  }
  return null;
}

function Leaderboard({ members, metric, period, meSub }: { members: MemberScore[]; metric: Metric; period: Period; meSub: string }) {
  const spec = METRICS.find((m) => m.key === metric)!;
  const ranked = rankMembers(members, spec, period);
  return (
    <div className="space-y-2">
      {ranked.map((m, i) => {
        const v = val(spec, m, period);
        const rank = v == null ? null : i + 1;
        const isMe = m.sub === meSub;
        return (
          <div key={m.sub} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5", isMe ? "bg-black/[0.04]" : "hover:bg-black/[0.02]")}>
            <span className="tabular w-6 shrink-0 text-center text-sm font-bold" style={{ color: rank && rank <= 3 ? MEDAL[rank - 1] : "#9a8f78" }}>{rank ?? "–"}</span>
            {m.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.picture} alt="" className="h-8 w-8 shrink-0 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: `${spec.color}22`, color: spec.color }}>{initials(m.name)}</span>
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-100">{m.name || "Member"}{isMe && <span className="ml-1.5 text-[11px] font-normal text-ink-500">you</span>}</span>
            <div className="text-right">
              <div className="tabular text-sm font-bold" style={{ color: spec.color }}>{v == null ? "—" : spec.fmt(v)}</div>
              {period === "today" && metric === "sleep" && m.sleepHours != null && <div className="text-[10px] text-ink-500">{m.sleepHours.toFixed(1)}h</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GroupCard({ group, meSub, period, onLeave }: { group: Group; meSub: string; period: Period; onLeave: (id: string) => void }) {
  const [metric, setMetric] = useState<Metric>("recovery");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const share = async () => {
    const link = `${window.location.origin}/friends?join=${group.code}`;
    if (navigator.share) { try { await navigator.share({ title: `Join ${group.name} on CURA`, url: link }); return; } catch { /* cancelled */ } }
    navigator.clipboard?.writeText(link); setCopied("link"); setTimeout(() => setCopied(null), 1500);
  };
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/[0.05] text-ink-300"><Users size={16} /></span>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-ink-50">{group.name}</div>
          <div className="text-[11px] text-ink-500">{group.members.length} member{group.members.length === 1 ? "" : "s"}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => { navigator.clipboard?.writeText(group.code); setCopied("code"); setTimeout(() => setCopied(null), 1500); }} className="tabular flex items-center gap-1.5 rounded-full border border-black/[0.1] px-3 py-1.5 text-xs font-semibold tracking-wide text-ink-200 hover:bg-black/[0.04]" title="Copy invite code">
            {copied === "code" ? <Check size={12} /> : <Copy size={12} />} {group.code}
          </button>
          <button onClick={share} className="flex items-center gap-1.5 rounded-full bg-recovery/15 px-3 py-1.5 text-xs font-semibold text-[#1c9e4b] hover:bg-recovery/25" title="Share invite link">
            {copied === "link" ? <Check size={12} /> : <Share2 size={12} />} Invite
          </button>
          <button onClick={() => onLeave(group.id)} className="rounded-full border border-black/[0.1] p-2 text-ink-400 hover:text-bad" title="Leave group"><LogOut size={13} /></button>
        </div>
      </div>

      <div className="mt-4 flex gap-1 rounded-xl bg-black/[0.03] p-1">
        {METRICS.map((m) => (
          <button key={m.key} onClick={() => setMetric(m.key)} className={cn("flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors", metric === m.key ? "bg-white text-ink-50 shadow-sm" : "text-ink-400")}>{m.label}</button>
        ))}
      </div>

      <div className="mt-3"><Leaderboard members={group.members} metric={metric} period={period} meSub={meSub} /></div>
    </Card>
  );
}

export default function FriendsPage() {
  const account = useAccount();
  const data = useHealth();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [period, setPeriod] = useState<Period>("today");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fetchGroups = useCallback(async () => {
    const r = await fetch("/api/social/groups", { cache: "no-store" }).catch(() => null);
    if (r?.ok) setGroups(((await r.json()) as { groups: Group[] }).groups);
    else setGroups([]);
  }, []);

  const doJoin = useCallback(async (rawCode: string) => {
    const r = await fetch("/api/social/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: rawCode.trim().toUpperCase() }) }).catch(() => null);
    if (r?.ok) { setCode(""); fetchGroups(); return true; }
    setError(r?.status === 404 ? "No group found with that code." : "Couldn't join.");
    return false;
  }, [fetchGroups]);

  // Read an invite (?join=CODE): prefill it, and auto-join if signed in.
  useEffect(() => {
    const j = new URLSearchParams(window.location.search).get("join");
    if (!j) return;
    setCode(j.toUpperCase());
    if (account.signedIn) { doJoin(j); window.history.replaceState({}, "", "/friends"); }
  }, [account.signedIn, doJoin]);

  // Publish my latest + 7-day-average scores so groups can rank me.
  const t = data.today;
  const days = data.days;
  useEffect(() => {
    if (!account.signedIn) return;
    (async () => {
      if (t) {
        const avg7 = (pick: (s: ScoredDay) => number | null) => {
          const v = days.map(pick).filter((x): x is number => x != null && isFinite(x)).slice(-7);
          return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
        };
        await fetch("/api/social/publish", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recovery: t.recovery.available === false ? null : Math.round(t.recovery.score),
            sleep: t.sleep.available === false ? null : Math.round(t.sleep.score),
            strain: t.strain.available === false ? null : Math.round(t.strain.score * 10) / 10,
            sleepHours: t.day.sleep.asleepMin > 0 ? Math.round((t.day.sleep.asleepMin / 60) * 10) / 10 : null,
            day: t.day.date,
            recovery7: avg7((s) => (s.recovery.available === false ? null : s.recovery.score)),
            sleep7: avg7((s) => (s.sleep.available === false ? null : s.sleep.score)),
            strain7: avg7((s) => (s.strain.available === false ? null : s.strain.score)),
          }),
        }).catch(() => {});
      }
      fetchGroups();
    })();
  }, [account.signedIn, t, days, fetchGroups]);

  const meSub = account.user?.sub ?? "";
  const field = "h-11 w-full rounded-xl border border-black/10 bg-black/[0.02] px-3.5 text-sm text-ink-100 outline-none focus:border-black/25";

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true); setError("");
    const r = await fetch("/api/social/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) }).catch(() => null);
    setBusy(false);
    if (r?.ok) { setName(""); fetchGroups(); } else setError("Couldn't create the group.");
  };
  const leave = async (id: string) => {
    if (!confirm("Leave this group?")) return;
    await fetch("/api/social/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: id }) }).catch(() => {});
    fetchGroups();
  };

  if (account.loading) return <SkeletonPage />;

  if (!account.signedIn) {
    return (
      <div className="animate-fadeUp">
        <PageHeader back title="Friends" sub="Form a group and compete on recovery, sleep and strain — on any wearable." />
        <Card className="mt-5 p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-recovery/12 text-recovery"><Trophy size={22} /></span>
          <h3 className="mt-4 font-display text-lg font-bold text-ink-50">Sign in to compete</h3>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-400">
            Friend groups sync through your account. Because everyone is scored by the same engine, a Fitbit, a Pixel
            Watch or a manual logger can all go head-to-head — cross-platform.
          </p>
          {code && <p className="mt-2 text-[12px] text-ink-500">You have an invite to code <span className="tabular font-semibold text-ink-300">{code}</span> — sign in and it&apos;ll be ready to join.</p>}
          <button onClick={account.signIn} className="mt-5 inline-flex items-center gap-2 rounded-full bg-recovery px-6 py-3 text-sm font-semibold text-[#241f18]"><LogIn size={16} /> Sign in with Google</button>
        </Card>
      </div>
    );
  }

  const nudge = groups ? topStanding(groups, meSub) : null;

  return (
    <div className="animate-fadeUp">
      <PageHeader
        back
        title="Friends"
        sub="Form a group and compete on recovery, sleep and strain — cross-platform."
        right={
          <SegmentedControl
            value={period}
            onChange={setPeriod}
            options={[{ value: "today" as Period, label: "Today" }, { value: "week" as Period, label: "This week" }]}
          />
        }
      />

      {nudge && (
        <Card className="mt-5 flex items-center gap-3 p-4" style={{ background: "linear-gradient(135deg, #f4c04e26, transparent)" }}>
          <span className="text-2xl">🏆</span>
          <p className="text-sm text-ink-100">You&apos;re <span className="font-bold">#1</span> in <span className="font-semibold">{nudge.group}</span> for {nudge.metric} this week — nice work.</p>
        </Card>
      )}

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
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && doJoin(code)} placeholder="6-character code" maxLength={6} className={cn(field, "tabular uppercase tracking-widest")} />
            <button onClick={() => doJoin(code)} disabled={busy || !code.trim()} className="shrink-0 rounded-xl border border-black/15 px-4 text-xs font-semibold text-ink-200 hover:bg-black/[0.05] disabled:opacity-40">Join</button>
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
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-400">Create a group and share its invite link with friends, or join one with a code they send you.</p>
        </Card>
      ) : (
        <Section title="Your groups" sub="Only your three headline scores are shared — nothing else." accent={DOMAIN_COLOR.recovery} icon={<Trophy size={15} />}>
          <div className="space-y-4">
            {groups.map((g) => <GroupCard key={g.id} group={g} meSub={meSub} period={period} onLeave={leave} />)}
          </div>
        </Section>
      )}
    </div>
  );
}
