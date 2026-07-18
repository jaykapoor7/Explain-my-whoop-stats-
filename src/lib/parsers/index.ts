import JSZip from "jszip";
import { DayRecord } from "../types";
import { ParsedFile, Provider } from "./provider";
import { whoopProvider } from "./whoop";
import { appleHealthProvider } from "./apple-health";
import { genericProvider } from "./generic";

/**
 * Provider registry — order matters: specific providers first, generic last.
 * To support a new platform, add its Provider here.
 */
const PROVIDERS: Provider[] = [whoopProvider, appleHealthProvider, genericProvider];

export interface ImportResult {
  days: DayRecord[];
  sources: string[]; // provider labels used
  fileNames: string[];
  skipped: string[]; // files no provider claimed
}

const TEXT_EXTENSIONS = [".csv", ".json", ".xml", ".txt"];

async function expandZip(file: File): Promise<ParsedFile[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const out: ParsedFile[] = [];
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const lower = entry.name.toLowerCase();
    if (!TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext))) continue;
    if (lower.includes("__macosx")) continue;
    out.push({ name: entry.name.split("/").pop() ?? entry.name, text: await entry.async("string") });
  }
  return out;
}

export async function importFiles(files: File[]): Promise<ImportResult> {
  const parsed: ParsedFile[] = [];
  for (const f of files) {
    const lower = f.name.toLowerCase();
    if (lower.endsWith(".zip")) parsed.push(...(await expandZip(f)));
    else if (TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext)))
      parsed.push({ name: f.name, text: await f.text() });
  }

  // Assign each file to the provider with the highest detect confidence.
  const claims = new Map<string, ParsedFile[]>();
  const skipped: string[] = [];
  for (const pf of parsed) {
    let best: Provider | null = null;
    let bestScore = 0;
    for (const p of PROVIDERS) {
      const score = p.detect(pf);
      if (score > bestScore) {
        best = p;
        bestScore = score;
      }
    }
    if (best && bestScore > 0.2) {
      claims.set(best.id, [...(claims.get(best.id) ?? []), pf]);
    } else skipped.push(pf.name);
  }

  const dayMap = new Map<string, DayRecord>();
  const sources: string[] = [];
  for (const provider of PROVIDERS) {
    const claimed = claims.get(provider.id);
    if (!claimed?.length) continue;
    sources.push(provider.label);
    for (const rec of provider.parse(claimed)) {
      const existing = dayMap.get(rec.date);
      if (!existing) dayMap.set(rec.date, rec);
      else {
        // Merge: earlier (more specific) providers win on conflicts.
        for (const [k, v] of Object.entries(rec)) {
          if (v === undefined) continue;
          if ((existing as unknown as Record<string, unknown>)[k] === undefined) {
            (existing as unknown as Record<string, unknown>)[k] = v;
          } else if (k === "workouts") {
            existing.workouts = [...(existing.workouts ?? []), ...(rec.workouts ?? [])];
          }
        }
      }
    }
  }

  const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { days, sources, fileNames: files.map((f) => f.name), skipped };
}
