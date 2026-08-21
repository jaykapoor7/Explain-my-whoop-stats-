import { NextRequest, NextResponse } from "next/server";
import { NutritionFood } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Food search backed by Open Food Facts — a free, open, no-API-key database with
 * strong coverage of Indian and international packaged products (Haldiram's, MTR,
 * Amul, Nestlé, and the like) plus generic items. We query it server-side so
 * there's no CORS or key exposure, then normalise every hit to CURA's per-serving
 * NutritionFood shape. The curated Indian/whole-food list (src/lib/foods.ts) is
 * merged in on the client for instant, offline-first staples; this endpoint is
 * the "vast database" layer for everything else.
 *
 * Nothing here is health-sensitive: it's a public food catalogue lookup keyed by
 * a text query, with no user identity attached.
 */

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};
const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: Record<string, unknown>;
}

function normalize(p: OffProduct): NutritionFood | null {
  const n = p.nutriments ?? {};
  const name = (p.product_name ?? "").trim();
  if (!name) return null;

  // Prefer per-serving values when the product declares a serving size; else
  // fall back to per-100 g (the near-universal field).
  const servKcal = num(n["energy-kcal_serving"]);
  const per100Kcal = num(n["energy-kcal_100g"]);
  let serving: string, kcal: number, protein: number, carbs: number, fat: number, fiber: number, sugar: number, sodiumG: number;

  if (servKcal > 0 && p.serving_size) {
    serving = String(p.serving_size).slice(0, 24);
    kcal = servKcal;
    protein = num(n["proteins_serving"]);
    carbs = num(n["carbohydrates_serving"]);
    fat = num(n["fat_serving"]);
    fiber = num(n["fiber_serving"]);
    sugar = num(n["sugars_serving"]);
    sodiumG = num(n["sodium_serving"]);
  } else if (per100Kcal > 0) {
    serving = "100 g";
    kcal = per100Kcal;
    protein = num(n["proteins_100g"]);
    carbs = num(n["carbohydrates_100g"]);
    fat = num(n["fat_100g"]);
    fiber = num(n["fiber_100g"]);
    sugar = num(n["sugars_100g"]);
    sodiumG = num(n["sodium_100g"]);
  } else {
    return null; // no usable energy value — skip
  }

  const brand = (p.brands ?? "").split(",")[0]?.trim();
  const label = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} · ${brand}` : name;

  return {
    id: `off-${p.code ?? name}`,
    name: label.slice(0, 60),
    serving,
    kcal: r0(kcal),
    protein: r1(protein),
    carbs: r1(carbs),
    fat: r1(fat),
    fiber: r1(fiber),
    sugar: r1(sugar),
    sodium: r0(sodiumG * 1000), // OFF reports sodium in grams
  };
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const url =
    "https://world.openfoodfacts.org/cgi/search.pl?" +
    new URLSearchParams({
      search_terms: q,
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: "24",
      fields: "code,product_name,brands,serving_size,nutriments",
    }).toString();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4500);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "CURA/1.0 (personal health app; food search)" },
      next: { revalidate: 86400 }, // cache identical queries for a day
    });
    if (!r.ok) return NextResponse.json({ results: [] });
    const j = (await r.json()) as { products?: OffProduct[] };
    const seen = new Set<string>();
    const results: NutritionFood[] = [];
    for (const p of j.products ?? []) {
      const f = normalize(p);
      if (!f) continue;
      const key = f.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(f);
      if (results.length >= 15) break;
    }
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] }); // offline / timeout — client keeps curated results
  } finally {
    clearTimeout(timer);
  }
}
