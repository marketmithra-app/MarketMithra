"use client";

import { useState } from "react";
import { signInWithEmail } from "@/lib/auth";

interface Props {
  onClose: () => void;
  redirectTo?: string; // optional magic-link redirect override
}

type Step = "input" | "sending" | "sent" | "error";

export default function SignInModal({ onClose, redirectTo }: Props) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [errMsg, setErrMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStep("sending");
    const { error } = await signInWithEmail(email.trim().toLowerCase(), redirectTo);
    if (error) {
      setErrMsg(error);
      setStep("error");
    } else {
      setStep("sent");
    }
  }

  return (
    /* backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-[#0d0f18] shadow-2xl p-8">

        {/* close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>

        {step === "sent" ? (
          /* ── success state ── */
          <div className="text-center">
            <div className="text-4xl mb-4">📬</div>
            <h2 className="text-lg font-black text-slate-100 mb-2">Check your email</h2>
            <p className="text-sm text-slate-400">
              We sent a sign-in link to{" "}
              <span className="text-amber-400 font-mono">{email}</span>.
              <br />Click it to log in — no password needed.
            </p>
            <p className="mt-4 text-[11px] text-slate-600">
              Link expires in 60 minutes · check spam if you don&apos;t see it
            </p>
          </div>
        ) : (
          /* ── input state ── */
          <>
            <div className="mb-6">
              <div className="text-2xl mb-2">🔐</div>
              <h2 className="text-lg font-black text-slate-100">Sign in to MarketMithra</h2>
              <p className="text-sm text-slate-400 mt-1">
                No password needed — we&apos;ll email you a magic link.
              </p>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-3">
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="rounded-full border border-slate-700 bg-[#11131c] px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
              <button
                type="submit"
                disabled={step === "sending"}
                className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-60 transition"
              >
                {step === "sending" ? "Sending…" : "Send magic link →"}
              </button>
            </form>

            {step === "error" && (
              <p className="mt-3 text-[12px] text-rose-400 text-center">{errMsg}</p>
            )}

            <p className="mt-5 text-[11px] text-slate-600 text-center">
              Signing in activates your Pro subscription if you have one.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
