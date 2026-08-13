"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, QrCode, RefreshCw, Smartphone, X } from "lucide-react";

interface Pairing { code: string; url: string; ttlMs: number; }

/** "Add another device": mint a pairing code and show it as a QR + short code. */
export function AddDeviceButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-black/15 px-4 py-2 text-xs font-medium text-ink-200 hover:bg-black/[0.06]"
      >
        <Smartphone size={13} /> Add a device
      </button>
      <AnimatePresence>{open && <PairModal onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function PairModal({ onClose }: { onClose: () => void }) {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [qr, setQr] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [remaining, setRemaining] = useState(0);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setError(""); setPairing(null); setQr("");
    const r = await fetch("/api/fitbit/pair/create", { method: "POST" }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as (Pairing & { message?: string }) | null;
    if (!r?.ok || !j?.code) { setError(j?.message ?? "Couldn't create a pairing code."); return; }
    setPairing(j);
    setRemaining(Math.round(j.ttlMs / 1000));
    try {
      setQr(await QRCode.toDataURL(j.url, { width: 460, margin: 1, color: { dark: "#211c14", light: "#ffffff" } }));
    } catch { /* code + link still work without the image */ }
  }, []);

  useEffect(() => { generate(); }, [generate]);

  useEffect(() => {
    if (!pairing || remaining <= 0) return;
    const t = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [pairing, remaining]);

  const expired = pairing !== null && remaining <= 0;
  const mm = String(Math.floor(remaining / 60)).padStart(1, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2a2417]/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", bounce: 0.18, duration: 0.4 }}
        onClick={(e) => e.stopPropagation()}
        className="card w-full max-w-sm p-6 text-center"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-50"><QrCode size={16} /> Add a device</span>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-100" aria-label="Close"><X size={17} /></button>
        </div>

        <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-ink-400">
          Scan this with your phone&apos;s camera to bring your Fitbit connection across — no setup to repeat. The code
          works once and expires in a few minutes.
        </p>

        <div className="mx-auto mt-4 flex h-[220px] w-[220px] items-center justify-center overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
          {error ? (
            <span className="px-4 text-xs text-bad">{error}</span>
          ) : !qr ? (
            <Loader2 size={22} className="animate-spin text-ink-400" />
          ) : expired ? (
            <span className="px-4 text-xs text-ink-400">Code expired</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Pairing QR code" className="h-full w-full" />
          )}
        </div>

        {pairing && !error && (
          <>
            <p className="mt-3 text-[11px] text-ink-500">
              Or open <span className="font-medium text-ink-300">/pair</span> on the other device and enter:
            </p>
            <button
              onClick={() => { navigator.clipboard?.writeText(pairing.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="tabular mx-auto mt-1.5 block rounded-lg bg-black/[0.05] px-3 py-1.5 text-sm font-semibold tracking-wide text-ink-100 hover:bg-black/[0.09]"
              title="Copy code"
            >
              {copied ? "Copied!" : pairing.code}
            </button>
            <p className="mt-3 text-[11px] text-ink-500">{expired ? "Expired" : `Expires in ${mm}:${ss}`}</p>
          </>
        )}

        {(expired || error) && (
          <button onClick={generate} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-recovery px-4 py-2 text-xs font-semibold text-[#241f18]">
            <RefreshCw size={13} /> New code
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
