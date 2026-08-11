"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Send } from "lucide-react";
import { PageHeader, SkeletonPage } from "@/components/ui";
import { useHealth } from "@/lib/data/use-health";
import { answer, SUGGESTIONS } from "@/lib/assistant/engine";
import { cn } from "@/lib/format";

interface Msg {
  role: "user" | "assistant";
  text: string;
}

export default function AssistantPage() {
  const data = useHealth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, thinking]);

  if (!data.hydrated) return <SkeletonPage />;

  const ask = (q: string) => {
    const query = q.trim();
    if (!query || thinking) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: query }]);
    setThinking(true);
    setTimeout(() => {
      setMsgs((m) => [...m, { role: "assistant", text: answer(query, data).text }]);
      setThinking(false);
    }, 350);
  };

  return (
    <div className="flex h-[calc(100dvh-10rem)] flex-col animate-fadeUp lg:h-[calc(100dvh-7rem)]">
      <PageHeader title="Assistant" sub="Ask about your stats — answered from your own data, entirely on-device." />

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto pb-3 pr-1">
        {msgs.length === 0 && (
          <div className="mx-auto max-w-md pt-6 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.06] text-ink-200">
              <MessageCircle size={19} />
            </span>
            <p className="mt-3 text-xs text-ink-400">Try one of these:</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-left text-xs text-ink-200 transition hover:border-white/[0.2] hover:bg-white/[0.05]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                m.role === "user" ? "rounded-br-md bg-recovery text-ink-950" : "card rounded-bl-md text-ink-100"
              )}
            >
              {m.text}
            </div>
          </motion.div>
        ))}

        {thinking && (
          <div className="flex gap-1 pl-1">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-ink-400"
                animate={{ opacity: [0.25, 1, 0.25] }}
                transition={{ repeat: Infinity, duration: 1, delay: i * 0.15 }}
              />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="card flex items-center gap-2 p-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Why is my recovery low?"
          className="h-10 min-w-0 flex-1 bg-transparent px-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || thinking}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-recovery text-ink-950 disabled:opacity-40"
          aria-label="Send"
        >
          <Send size={15} />
        </button>
      </form>
      <p className="mt-2 text-center text-[10px] text-ink-500">Deterministic, on-device analysis of your logged data. Not medical advice.</p>
    </div>
  );
}
