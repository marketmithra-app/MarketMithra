"use client";

import { useState } from "react";

type State = "idle" | "loading" | "success" | "error";

export default function DigestOptIn() {
  const [state, setState] = useState<State>("idle");
  const [email, setEmail] = useState("");
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (json.ok === true) {
        setConfirmedEmail(email);
        setState("success");
      } else {
        setErrorMsg(json.error ?? "Something went wrong. Please try again.");
        setState("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setState("error");
    }
  }

  function handleReset() {
    setEmail("");
    setConfirmedEmail("");
    setErrorMsg("");
    setState("idle");
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-[#0d0f18] dark:to-[#11131c] p-5">
      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
        📬 Daily digest — free
      </div>
      <div className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 mb-3">
        Get an email when your watched stocks flip verdict.
      </div>

      {state === "success" ? (
        <div className="flex items-start gap-2">
          <span className="text-emerald-500 text-base leading-none mt-0.5">✓</span>
          <div>
            <p className="text-sm text-slate-800 dark:text-slate-200">
              You&apos;re on the list! We&apos;ll send daily BUY/SELL flip alerts to{" "}
              <span className="font-semibold">{confirmedEmail}</span>.
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] text-slate-400 hover:text-amber-500 transition mt-1 underline underline-offset-2"
            >
              change?
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2">
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={state === "loading"}
              className="flex-1 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11131c] px-4 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-amber-400 transition"
            />
            <button
              type="submit"
              disabled={state === "loading"}
              className="rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-50 transition whitespace-nowrap"
            >
              {state === "loading" ? (
                <span className="flex items-center gap-1.5">
                  <svg
                    className="animate-spin h-3 w-3 text-slate-900"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Saving…
                </span>
              ) : (
                "Notify me →"
              )}
            </button>
          </div>

          {state === "error" && (
            <p className="text-[11px] text-rose-500 mt-2">{errorMsg}</p>
          )}

          <p className="text-[10px] text-slate-400 mt-2">
            No spam · unsubscribe any time
          </p>
        </form>
      )}
    </div>
  );
}
