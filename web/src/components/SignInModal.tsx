"use client";

import { useState } from "react";
import { signInWithEmail, signInWithGoogle } from "@/lib/auth";

interface Props {
  onClose: () => void;
  redirectTo?: string; // optional magic-link redirect override
}

type Step = "input" | "sending" | "sent" | "error" | "google";

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
                No password needed — sign in with Google or a magic link.
              </p>
            </div>

            {/* Google sign-in */}
            <button
              type="button"
              disabled={step === "sending" || step === "google"}
              onClick={async () => {
                setStep("google");
                const { error } = await signInWithGoogle(redirectTo);
                if (error) { setErrMsg(error); setStep("error"); }
                // on success the browser navigates away — no state update needed
              }}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-700 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60 transition"
            >
              {/* Official Google "G" mark */}
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
                <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58Z"/>
              </svg>
              {step === "google" ? "Redirecting…" : "Continue with Google"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="text-[11px] text-slate-600">or use email</span>
              <div className="flex-1 h-px bg-slate-800" />
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
