"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Send, X } from "lucide-react";
import { useHealth } from "@/lib/data/use-health";
import { answer, SUGGESTIONS } from "@/lib/assistant/engine";
import { cn } from "@/lib/format";

interface Msg { role: "user" | "assistant"; text: string }

/**
 * Floating AI coach — a WHOOP-style button that hovers over every screen and
 * expands into a chat. Answered entirely from the user's own data, on-device.
 * Replaces the standalone Assistant nav section.
 */
export function Coach() {
  const data = useHealth();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, thinking, open]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 250); }, [open]);

  const ask = (q: string) => {
    const query = q.trim();
    if (!query || thinking || !data.hydrated) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: query }]);
    setThinking(true);
    setTimeout(() => {
      setMsgs((m) => [...m, { role: "assistant", text: answer(query, data).text }]);
      setThinking(false);
    }, 350);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open CURA coach"
        className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-ink-50 text-ink-950 shadow-lift transition-transform hover:scale-105 active:scale-95 lg:bottom-6 lg:right-6"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}><X size={22} /></motion.span>
          ) : (
            <motion.span key="s" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}><MessageCircle size={22} /></motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", bounce: 0.14, duration: 0.4 }}
            className="fixed inset-x-3 bottom-40 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-3xl border border-black/[0.08] bg-ink-850 shadow-2xl sm:inset-x-auto sm:right-6 sm:w-[380px] lg:bottom-24"
          >
            {/* header */}
            <div className="flex items-center gap-2.5 border-b border-black/[0.06] px-4 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-recovery/15 text-recovery"><MessageCircle size={15} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-ink-50">CURA Coach</div>
                <div className="text-[10px] text-ink-400">Answers from your own data, on-device</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-ink-400 hover:text-ink-100"><X size={17} /></button>
            </div>

            {/* messages */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {msgs.length === 0 && (
                <div className="pt-1 text-center">
                  <p className="text-xs text-ink-400">Ask me about your recovery, sleep, energy or trends.</p>
                  <div className="mt-3 grid gap-2">
                    {SUGGESTIONS.slice(0, 4).map((s) => (
                      <button key={s} onClick={() => ask(s)} className="rounded-xl border border-black/[0.08] bg-black/[0.02] px-3 py-2 text-left text-xs text-ink-200 transition hover:border-black/[0.2] hover:bg-black/[0.05]">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed", m.role === "user" ? "bg-recovery text-[#241f18]" : "border border-black/[0.06] bg-black/[0.03] text-ink-200")}>
                    {m.text}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-black/[0.06] bg-black/[0.03] px-3.5 py-2.5">
                    <span className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-ink-400" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
                      ))}
                    </span>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* input */}
            <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 border-t border-black/[0.06] p-3">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your coach…"
                className="h-10 flex-1 rounded-full border border-black/10 bg-black/[0.02] px-4 text-sm text-ink-100 outline-none focus:border-black/25"
              />
              <button type="submit" disabled={!input.trim() || thinking} aria-label="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-recovery text-[#241f18] disabled:opacity-40">
                <Send size={16} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
