import { CalendarEvent, DayRecord } from "../types";

/**
 * Generates a plausible work/life calendar for the demo dataset, derived
 * from the generated health data so the relationships the product promises
 * (meetings ↔ stress ↔ HRV, early meetings ↔ short sleep, social evenings ↔
 * alcohol nights, flights ↔ travel days) actually exist to be discovered.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MEETING_TITLES = [
  "Team standup", "Product sync", "1:1 with Sam", "Design review", "Sprint planning",
  "Client call", "Roadmap review", "Eng sync", "All hands", "Hiring interview",
  "Marketing check-in", "Budget review", "Partner call", "Retro", "Demo prep",
];
const SOCIAL_TITLES = [
  "Dinner with friends", "Drinks with the team", "Birthday party", "Date night",
  "Game night", "Concert", "Happy hour", "BBQ at Alex's",
];
const CITIES = ["JFK", "LAX", "ORD", "AUS", "SEA", "DEN", "MIA"];
const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function generateDemoCalendar(days: DayRecord[]): CalendarEvent[] {
  const rand = mulberry32(99120718);
  const events: CalendarEvent[] = [];
  let id = 0;
  const push = (e: Omit<CalendarEvent, "id">) => events.push({ ...e, id: `demo-${id++}` });

  for (const day of days) {
    const dow = new Date(day.date + "T12:00:00").getDay();
    const workday = dow >= 1 && dow <= 5;
    const stress = day.stress ?? 5;
    const sleepH = day.sleepHours ?? 7.3;

    // ---- flights on travel days ----
    if (day.travel) {
      const from = CITIES[Math.floor(rand() * CITIES.length)];
      let to = CITIES[Math.floor(rand() * CITIES.length)];
      if (to === from) to = "SFO";
      const dep = round1(7 + rand() * 11);
      push({
        date: day.date, title: `Flight SFO → ${to}`, type: "travel",
        startHour: dep, endHour: round1(dep + 3 + rand() * 3), durationMin: Math.round(180 + rand() * 180),
        location: `${from} Airport`,
      });
    }

    // ---- meetings on workdays (count tracks stress so context ↔ physiology correlates) ----
    if (workday && !day.travel) {
      const count = Math.round(clamp(0.8 + stress * 0.62 + (rand() - 0.5) * 2.4, 0, 9));
      // Early first meeting on short-sleep mornings (the meeting forced the early alarm).
      const firstStart = clamp(8.4 + (sleepH - 7.2) * 1.1 + (rand() - 0.5) * 1.6, 7, 12);
      const office = rand() < clamp(0.18 + stress * 0.055, 0.1, 0.75);
      let cursor = firstStart;
      for (let i = 0; i < count; i++) {
        const dur = rand() < 0.62 ? 30 : rand() < 0.85 ? 60 : 45;
        // back-to-back blocks appear on heavy days
        const gap = count >= 5 && rand() < 0.55 ? 0 : round1(rand() * 1.5 + 0.25);
        const start = round1(cursor + gap);
        if (start > 17.5) break;
        push({
          date: day.date,
          title: MEETING_TITLES[Math.floor(rand() * MEETING_TITLES.length)],
          type: "meeting",
          startHour: start,
          endHour: round1(start + dur / 60),
          durationMin: dur,
          location: office ? "HQ — Conference Room 4" : "Zoom",
        });
        cursor = start + dur / 60;
        if (cursor > 11.8 && cursor < 13 && rand() < 0.7) cursor = 13; // lunch break
      }
    }

    // ---- gym events mirror actual workouts ----
    for (const w of day.workouts ?? []) {
      if (w.sport === "Walking") continue;
      push({
        date: day.date,
        title: w.sport === "Weightlifting" ? "Gym — lift" : `${w.sport} session`,
        type: "workout",
        startHour: w.startHour ?? 17,
        endHour: round1((w.startHour ?? 17) + w.durationMin / 60),
        durationMin: w.durationMin,
        location: w.sport === "Running" || w.sport === "Cycling" ? "Outdoor" : "Iron Works Gym",
      });
    }

    // ---- social evenings line up with alcohol nights ----
    if ((day.alcoholDrinks ?? 0) > 0 || (!workday && rand() < 0.2)) {
      const start = round1(18.5 + rand() * 2);
      push({
        date: day.date,
        title: SOCIAL_TITLES[Math.floor(rand() * SOCIAL_TITLES.length)],
        type: "social",
        startHour: start,
        endHour: round1(start + 2 + rand() * 2.5),
        durationMin: Math.round(120 + rand() * 150),
        location: rand() < 0.5 ? "Downtown" : undefined,
      });
    }

    // ---- occasional study block ----
    if (rand() < 0.12) {
      const start = round1(workday ? 19 + rand() * 1.5 : 10 + rand() * 6);
      push({
        date: day.date, title: "Study — Spanish course", type: "study",
        startHour: start, endHour: round1(start + 1), durationMin: 60,
      });
    }
  }
  return events;
}
