"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays, CheckCircle2, FileUp, Loader2, Lock, Plug, ShieldCheck, Trash2 } from "lucide-react";
import { Button, Card, FadeIn } from "@/components/ui";
import { importFiles } from "@/lib/parsers";
import { parseIcs } from "@/lib/calendar/ics";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

const FORMATS = [
  { name: "WHOOP", detail: "physiological_cycles, sleeps, workouts, journal CSVs (or the full ZIP)" },
  { name: "Apple Health", detail: "export.xml or export.zip from the Health app" },
  { name: "Fitbit", detail: "Google Takeout / Fitbit data export (CSV, JSON)" },
  { name: "Garmin Connect", detail: "Export CSVs from Garmin Connect reports" },
  { name: "Oura", detail: "Trends CSV or JSON export" },
  { name: "Polar / Coros / Samsung", detail: "Any CSV/JSON with dated health columns" },
  { name: "Your own spreadsheet", detail: "A CSV with a date column and any metrics" },
];

type Status =
  | { state: "idle" }
  | { state: "parsing" }
  | { state: "done"; days: number; sources: string[]; skipped: string[] }
  | { state: "error"; message: string };

function CalendarConnect() {
  const inputRef = useRef<HTMLInputElement>(null);
  const setCalendar = useApp((s) => s.setCalendar);
  const clearCalendar = useApp((s) => s.clearCalendar);
  const calendarMeta = useApp((s) => s.calendarMeta);
  const calendarEvents = useApp((s) => s.calendarEvents);
  const days = useApp((s) => s.days);
  const hydrated = useApp((s) => s.hydrated);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState("Google Calendar");

  const handleIcs = async (files: File[]) => {
    setError(null);
    try {
      const events = files.length
        ? (await Promise.all(files.map(async (f) => parseIcs(await f.text(), days[0]?.date, days[days.length - 1]?.date)))).flat()
        : [];
      if (!events.length) {
        setError("No events found in that file — make sure it's an .ics export with events inside your data's date range.");
        return;
      }
      setCalendar(events, {
        source,
        fileNames: files.map((f) => f.name),
        importedAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse the calendar file.");
    }
  };

  return (
    <FadeIn delay={0.16}>
      <Card id="calendar" className="mt-8 scroll-mt-24 p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent-soft">
            <CalendarDays size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">Connect your calendar</h3>
            <p className="mt-1 text-sm leading-relaxed text-base-300">
              This is where the product gets interesting: meetings, flights, social evenings and study blocks get
              cross-referenced with HRV, recovery and sleep — so the app can explain <em>why</em> your metrics moved,
              not just that they did. The calendar file is parsed locally and never uploaded.
            </p>

            {hydrated && calendarMeta ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-status-good/25 bg-status-good/[0.06] px-4 py-3">
                <div className="text-sm">
                  <span className="font-medium text-[#6ee7b7]">{calendarMeta.source} connected</span>
                  <span className="ml-2 text-xs text-base-400">
                    {calendarEvents.length} events · {calendarMeta.fileNames.join(", ")}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
                    Replace
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (confirm("Disconnect calendar and delete its events from this device?")) clearCalendar();
                    }}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {["Google Calendar", "Apple Calendar", "Outlook / other"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSource(s)}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-xs font-medium transition",
                      source === s ? "bg-white text-base-950" : "border border-white/10 text-base-300 hover:bg-white/[0.06]"
                    )}
                  >
                    {s}
                  </button>
                ))}
                <Button size="sm" className="ml-auto" onClick={() => inputRef.current?.click()}>
                  <FileUp size={13} /> Import .ics
                </Button>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept=".ics,text/calendar"
              multiple
              className="hidden"
              onChange={(e) => handleIcs(Array.from(e.target.files ?? []))}
            />

            {!calendarMeta && (
              <p className="mt-3 text-xs leading-relaxed text-base-400">
                {source === "Google Calendar" &&
                  "Google Calendar → Settings → Import & export → Export. Unzip and import the .ics for your main calendar."}
                {source === "Apple Calendar" &&
                  "Apple Calendar → select a calendar → File → Export → Export…. Import the resulting .ics file."}
                {source === "Outlook / other" &&
                  "Any calendar app that exports iCalendar (.ics) works — events are classified automatically by title."}
              </p>
            )}
            {error && <p className="mt-3 text-xs text-[#ffa2b0]">{error}</p>}
          </div>
        </div>
      </Card>
    </FadeIn>
  );
}

export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const setData = useApp((s) => s.setData);
  const clearAll = useApp((s) => s.clearAll);
  const meta = useApp((s) => s.meta);
  const hydrated = useApp((s) => s.hydrated);
  const router = useRouter();

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setStatus({ state: "parsing" });
      try {
        const result = await importFiles(files);
        if (!result.days.length) {
          setStatus({
            state: "error",
            message:
              "No recognizable health data found. Check that the file contains a date column and metrics like recovery, HRV, sleep or steps.",
          });
          return;
        }
        setData(result.days, {
          source: result.sources.join(" + ") || "Import",
          fileNames: result.fileNames,
          importedAt: new Date().toISOString(),
        });
        setStatus({ state: "done", days: result.days.length, sources: result.sources, skipped: result.skipped });
        setTimeout(() => router.push("/dashboard"), 1400);
      } catch (e) {
        setStatus({ state: "error", message: e instanceof Error ? e.message : "Failed to parse files." });
      }
    },
    [setData, router]
  );

  return (
    <div className="mx-auto max-w-3xl">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">Upload your data</h1>
        <p className="mt-1 text-sm text-base-400">
          CSV, JSON, ZIP exports and Apple Health XML. Everything is parsed locally in your browser.
        </p>
        <Link
          href="/connections"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/[0.08] px-3.5 py-1.5 text-xs font-medium text-accent-soft transition hover:bg-accent/[0.14]"
        >
          <Plug size={13} /> Prefer auto-sync? Connect WHOOP, Oura or Fitbit →
        </Link>
      </FadeIn>

      <FadeIn delay={0.08}>
        <motion.div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(Array.from(e.dataTransfer.files));
          }}
          onClick={() => inputRef.current?.click()}
          animate={{ scale: dragOver ? 1.01 : 1 }}
          className={cn(
            "mt-8 flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors",
            dragOver ? "border-accent bg-accent/[0.06]" : "border-white/12 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.03]"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".csv,.json,.zip,.xml,.txt"
            className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
          />
          {status.state === "parsing" ? (
            <>
              <Loader2 size={28} className="animate-spin text-accent-soft" />
              <p className="text-sm text-base-300">Parsing locally — nothing leaves your device…</p>
            </>
          ) : status.state === "done" ? (
            <>
              <CheckCircle2 size={30} className="text-[#6ee7b7]" />
              <div>
                <p className="font-medium">
                  Imported {status.days} days {status.sources.length ? `from ${status.sources.join(" + ")}` : ""}
                </p>
                {status.skipped.length > 0 && (
                  <p className="mt-1 text-xs text-base-400">Skipped (unrecognized): {status.skipped.join(", ")}</p>
                )}
                <p className="mt-1 text-xs text-base-400">Opening your dashboard…</p>
              </div>
            </>
          ) : (
            <>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12 text-accent-soft">
                <FileUp size={24} strokeWidth={1.8} />
              </span>
              <div>
                <p className="font-medium">Drop files here or click to browse</p>
                <p className="mt-1 text-xs text-base-400">.csv · .json · .zip · .xml — multiple files welcome</p>
              </div>
            </>
          )}
        </motion.div>
      </FadeIn>

      {status.state === "error" && (
        <p className="mt-4 rounded-xl border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-[#ffa2b0]">
          {status.message}
        </p>
      )}

      <FadeIn delay={0.14} className="mt-8 grid gap-3 sm:grid-cols-2">
        {FORMATS.map((f) => (
          <div key={f.name} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <div className="text-sm font-medium">{f.name}</div>
            <div className="mt-0.5 text-xs leading-relaxed text-base-400">{f.detail}</div>
          </div>
        ))}
      </FadeIn>

      <CalendarConnect />

      <FadeIn delay={0.2}>
        <Card className="mt-8 flex items-start gap-4 border-status-good/15 bg-status-good/[0.04]">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-[#6ee7b7]" />
          <div className="text-sm leading-relaxed text-base-300">
            <span className="font-medium text-white">Local-first by design.</span> Files are parsed in
            your browser and stored only on this device. No account, no server upload, and your
            health data is never used to train AI models.{" "}
            <Lock size={12} className="inline text-base-400" />
          </div>
        </Card>
      </FadeIn>

      {hydrated && meta && (
        <FadeIn delay={0.24} className="mt-6 flex items-center justify-between rounded-xl border border-white/[0.06] px-4 py-3 text-sm">
          <span className="text-base-400">
            Currently loaded: <span className="text-base-100">{meta.source}</span> ({meta.fileNames.join(", ")})
          </span>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (confirm("Delete all uploaded data from this device?")) {
                clearAll();
                setStatus({ state: "idle" });
              }
            }}
          >
            <Trash2 size={13} /> Delete all
          </Button>
        </FadeIn>
      )}
    </div>
  );
}
