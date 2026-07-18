"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eraser, Send, Sparkles } from "lucide-react";
import { useApp } from "@/lib/store";
import { RequireData } from "@/components/require-data";
import { MiniMarkdown } from "@/components/ui";
import { CompareBars, CorrelationScatter, TrendChart } from "@/components/charts";
import { answerQuestion, SUGGESTED_QUESTIONS } from "@/lib/chat-engine";
import { ChatMessage, Insight } from "@/lib/types";
import { rollingMean } from "@/lib/stats";
import { uid } from "@/lib/utils";

function MessageChart({ chart }: { chart: Insight["chart"] }) {
  if (chart.kind === "scatter")
    return <CorrelationScatter points={chart.points} xKey={chart.xKey} yKey={chart.yKey} trend={chart.trend} height={220} />;
  if (chart.kind === "compare") return <CompareBars groups={chart.groups} metric={chart.metric} height={200} />;
  const avg = rollingMean(chart.points.map((p) => p.value), 7);
  return (
    <TrendChart
      data={chart.points.map((p, i) => ({ date: p.date, value: p.value, avg: avg[i] }))}
      metric={chart.metric}
      height={200}
    />
  );
}

function ChatBody() {
  const days = useApp((s) => s.days);
  const chat = useApp((s) => s.chat);
  const addChatMessage = useApp((s) => s.addChatMessage);
  const clearChat = useApp((s) => s.clearChat);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length, thinking]);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q || thinking) return;
    setInput("");
    addChatMessage({ id: uid(), role: "user", content: q, timestamp: Date.now() });
    setThinking(true);
    // Brief delay so the exchange reads naturally; analysis itself is synchronous and local.
    setTimeout(() => {
      const answer = answerQuestion(q, days);
      addChatMessage({
        id: uid(),
        role: "assistant",
        content: answer.content,
        chart: answer.chart,
        timestamp: Date.now(),
      });
      setThinking(false);
    }, 450 + Math.random() * 350);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col lg:h-[calc(100vh-5.5rem)]">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ask Your Health Data</h1>
          <p className="mt-1 text-sm text-base-400">
            Every answer is computed from your {days.length} days of data, with the reasoning shown.
          </p>
        </div>
        {chat.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-base-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <Eraser size={12} /> Clear
          </button>
        )}
      </div>

      <div className="mt-5 flex-1 space-y-4 overflow-y-auto pb-4 pr-1">
        {chat.length === 0 && (
          <div className="mx-auto max-w-xl pt-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/12 text-accent-soft">
              <Sparkles size={20} />
            </span>
            <p className="mt-4 text-sm text-base-300">Ask anything about your patterns. Some starters:</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5 text-left text-xs text-base-200 transition hover:border-accent/40 hover:bg-accent/[0.06]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {chat.map((m: ChatMessage) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              {m.role === "user" ? (
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-white">
                  {m.content}
                </div>
              ) : (
                <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-white/[0.06] bg-base-850 px-4 py-3.5 sm:max-w-[80%]">
                  <MiniMarkdown text={m.content} />
                  {m.chart && (
                    <div className="mt-3 rounded-xl border border-white/[0.06] bg-base-900 p-3">
                      <MessageChart chart={m.chart} />
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {thinking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 pl-1 text-xs text-base-400">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-accent-soft"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.18 }}
                />
              ))}
            </span>
            analyzing your data…
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="glass sticky bottom-0 mt-2 flex items-center gap-2 rounded-2xl p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. What hurts my HRV the most?"
          className="h-10 flex-1 bg-transparent px-3 text-sm text-white placeholder:text-base-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || thinking}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white transition hover:bg-accent-soft disabled:opacity-40"
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

export default function ChatPage() {
  return (
    <RequireData>
      <ChatBody />
    </RequireData>
  );
}
