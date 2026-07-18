/** Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, newlines in quotes). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()));
    return obj;
  });
}

export function num(v: string | undefined): number | undefined {
  if (v === undefined || v === "") return undefined;
  const n = parseFloat(v.replace(/,/g, ""));
  return isFinite(n) ? n : undefined;
}

/** Normalize any date-ish string to YYYY-MM-DD (local). */
export function toDateKey(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const trimmed = v.trim();
  // Already ISO date
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return undefined;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Extract fractional hour-of-day from a datetime string; hours past midnight get +24 so bedtimes sort. */
export function toHourOfDay(v: string | undefined, lateNightWrap = false): number | undefined {
  if (!v) return undefined;
  const m = v.match(/(\d{1,2}):(\d{2})/);
  if (!m) return undefined;
  let h = parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
  if (lateNightWrap && h < 12) h += 24;
  return Math.round(h * 10) / 10;
}
