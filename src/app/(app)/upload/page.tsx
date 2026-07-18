"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, FileUp, Loader2, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { Button, Card, FadeIn } from "@/components/ui";
import { importFiles } from "@/lib/parsers";
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
              <CheckCircle2 size={30} className="text-[#5ecb5e]" />
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
        <p className="mt-4 rounded-xl border border-status-critical/30 bg-status-critical/10 px-4 py-3 text-sm text-[#f28b8b]">
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

      <FadeIn delay={0.2}>
        <Card className="mt-8 flex items-start gap-4 border-status-good/15 bg-status-good/[0.04]">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-[#5ecb5e]" />
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
