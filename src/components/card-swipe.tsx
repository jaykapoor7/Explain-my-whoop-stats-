"use client";

import { ReactNode, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ArrowLeft, ArrowRight, BatteryCharging, HeartPulse, Moon } from "lucide-react";

interface SwipeCard {
  title: string;
  color: string;
  score: number;
  scale?: string;
  note: string;
  description: string;
  icon: ReactNode;
}

/** Static score ring (no count-up — this is a marketing deck, rendered many times). */
function DeckRing({ score, color, label, scale }: { score: number; color: string; label: string; scale?: string }) {
  const size = 112, stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = scale ? score / 21 : score / 100;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(59,46,20,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular font-display text-[1.9rem] font-bold leading-none tracking-[-0.02em] text-ink-50">
          {score}{scale && <span className="text-[11px] text-ink-400">{scale}</span>}
        </span>
        <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

const CARDS: SwipeCard[] = [
  { title: "Recovery", color: "#13b57e", score: 72, note: "HRV +1.3σ vs your normal", description: "How ready your body is today, from overnight HRV and resting heart rate against your own baseline.", icon: <HeartPulse size={20} /> },
  { title: "Sleep", color: "#7b68ee", score: 88, note: "8h 02m · 94% efficiency", description: "A nightly score from time asleep vs your personal need, plus deep, REM and efficiency.", icon: <Moon size={20} /> },
  { title: "Strain", color: "#ef5a45", score: 11.4, scale: "/21", note: "Threshold run · zone 4", description: "Cardiovascular load scored against your own heart-rate reserve — not a generic curve.", icon: <Activity size={20} /> },
  { title: "Energy", color: "#eb9d18", score: 65, note: "65% battery left at 2pm", description: "The capacity you woke with and how much is left, from recovery, sleep and yesterday's load.", icon: <BatteryCharging size={20} /> },
];

/**
 * A swipeable, stacked card deck (drag or arrows) showcasing the four daily
 * scores on the landing. Built natively on the app's design system + the
 * framer-motion we already ship — no extra icon/carousel dependencies.
 */
export function ScoresShowcase() {
  const items = CARDS;
  const n = items.length;
  const [[index, dir], setState] = useState<[number, number]>([0, 0]);
  const paginate = (d: number) => setState(([i]) => [(i + d + n) % n, d]);
  const card = items[index];

  return (
    <div className="mx-auto w-full max-w-sm select-none">
      <div className="relative h-[330px]">
        {/* Stacked ghost layers behind the active card for depth. */}
        <div className="absolute inset-x-6 top-4 h-full rounded-[1.5rem] border border-black/[0.05] bg-[#f4efe4]" style={{ transform: "scale(0.9)" }} />
        <div className="absolute inset-x-3 top-2 h-full rounded-[1.5rem] border border-black/[0.06] bg-[#f8f3ea]" style={{ transform: "scale(0.95)" }} />

        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={index}
            custom={dir}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={(_, info) => {
              if (info.offset.x < -70 || info.velocity.x < -450) paginate(1);
              else if (info.offset.x > 70 || info.velocity.x > 450) paginate(-1);
            }}
            initial={{ x: dir > 0 ? 320 : dir < 0 ? -320 : 0, opacity: 0, scale: 0.96 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: dir > 0 ? -320 : 320, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", bounce: 0.18, duration: 0.5 }}
            whileTap={{ cursor: "grabbing" }}
            className="absolute inset-0 cursor-grab"
          >
            <div className="card flex h-full flex-col p-7">
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `${card.color}1c`, color: card.color, boxShadow: `inset 0 0 0 1px ${card.color}22` }}>
                  {card.icon}
                </span>
                <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: `${card.color}18`, color: card.color }}>
                  {card.note}
                </span>
              </div>

              <div className="mt-5 flex items-center gap-5">
                <DeckRing score={card.score} color={card.color} label={card.title} scale={card.scale} />
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-bold tracking-[-0.01em] text-ink-50">{card.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-400">{card.description}</p>
                </div>
              </div>

              <div className="mt-auto flex items-center gap-1.5 pt-5 text-[11px] font-medium text-ink-500">
                <ArrowLeft size={12} /> drag, or use the arrows
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls: arrows + progress dots. */}
      <div className="mt-5 flex items-center justify-between">
        <button
          onClick={() => paginate(-1)}
          aria-label="Previous"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.1] bg-[#fdfaf3] text-ink-400 transition hover:border-black/20 hover:text-ink-100"
        >
          <ArrowLeft size={15} />
        </button>
        <div className="flex items-center gap-1.5">
          {items.map((it, i) => (
            <button
              key={it.title}
              onClick={() => setState([i, i > index ? 1 : -1])}
              aria-label={`Go to ${it.title}`}
              className="h-2 rounded-full transition-all"
              style={{ width: i === index ? 22 : 8, background: i === index ? it.color : "rgba(59,46,20,0.16)" }}
            />
          ))}
        </div>
        <button
          onClick={() => paginate(1)}
          aria-label="Next"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.1] bg-[#fdfaf3] text-ink-400 transition hover:border-black/20 hover:text-ink-100"
        >
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
