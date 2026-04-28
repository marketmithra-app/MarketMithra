"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import SignInModal from "@/components/SignInModal";

interface Props {
  symbol?: string;
}

export default function SignInGate({ symbol }: Props) {
  const [showModal, setShowModal] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const ticker = symbol?.replace(".NS", "").replace(".BO", "") ?? "this stock";

  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        container!.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <div aria-hidden="true" className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-2 p-4"
        style={{ filter: "blur(5px)", opacity: 0.25 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-lg"
            style={{ background: i === 1 ? "#0d1f35" : i === 4 ? "#2d1f0d" : "#1e293b" }} />
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="gate-title"
          aria-describedby="gate-desc"
          className="w-full max-w-[260px] rounded-2xl border border-white/[0.08] p-5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.7)] animate-in fade-in zoom-in-95 duration-200"
          style={{
            background: "rgba(13,15,26,0.80)",
            ["WebkitBackdropFilter" as never]: "blur(12px)",
            backdropFilter: "blur(12px)",
          }}
        >
          <Lock className="mx-auto mb-2 h-5 w-5 text-amber-400" aria-hidden="true" />
          <h2 id="gate-title" className="mb-1 text-[13px] font-bold text-slate-100">
            Sign in to analyse {ticker}
          </h2>
          <p id="gate-desc" className="mb-3 text-[12px] text-slate-400 leading-snug">
            6 indicators · AI synthesis · price targets
          </p>
          <button
            ref={primaryRef}
            onClick={() => setShowModal(true)}
            className="mb-2 w-full min-h-[44px] rounded-full bg-amber-400 px-4 py-2.5 text-[13px] font-bold text-slate-900 transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            Sign in free →
          </button>
          <p className="text-[12px] text-slate-500">5 analyses / week · no credit card</p>
        </div>
      </div>

      {showModal && (
        <SignInModal
          onClose={() => setShowModal(false)}
          redirectTo={
            symbol
              ? `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=${encodeURIComponent(`/canvas/${symbol}`)}`
              : `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`
          }
        />
      )}
    </>
  );
}
