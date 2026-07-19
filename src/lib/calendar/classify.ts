import { EventType } from "../types";

/** Keyword-based event classifier. Extend RULES to teach it new patterns. */

const RULES: { type: EventType; keywords: string[] }[] = [
  {
    type: "travel",
    keywords: ["flight", "fly ", "airport", "boarding", "train to", "drive to", "✈", "layover", "check-in", "hotel"],
  },
  {
    type: "vacation",
    keywords: ["vacation", "holiday", "ooo", "out of office", "pto", "trip"],
  },
  {
    type: "workout",
    keywords: [
      "gym", "workout", "lift", "leg day", "run", "running", "cycling", "ride", "yoga", "swim",
      "crossfit", "pilates", "training session", "climb", "tennis", "hiit", "spin class",
    ],
  },
  {
    type: "study",
    keywords: ["study", "class", "lecture", "course", "exam", "homework", "reading", "tutorial", "seminar"],
  },
  {
    type: "social",
    keywords: [
      "dinner", "drinks", "party", "birthday", "date night", "hangout", "bbq", "brunch",
      "concert", "wedding", "bar ", "happy hour", "game night", "movie",
    ],
  },
  {
    type: "meeting",
    keywords: [
      "meeting", "sync", "standup", "stand-up", "1:1", "1-1", "review", "interview", "call",
      "check-in", "planning", "retro", "demo", "presentation", "all hands", "all-hands",
      "kickoff", "huddle", "office hours", "sprint", "catchup", "catch up", "townhall", "town hall",
    ],
  },
];

export function classifyEvent(title: string, location: string | undefined, allDay: boolean | undefined): EventType {
  const haystack = `${title} ${location ?? ""}`.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => haystack.includes(k))) return rule.type;
  }
  // Heuristics for untitled patterns: timed weekday events with attendees-style
  // titles default to meeting; all-day defaults to personal.
  if (allDay) return "personal";
  return "meeting";
}
