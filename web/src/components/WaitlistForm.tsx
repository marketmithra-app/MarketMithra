"use client";

import { useState } from "react";

type State = "idle" | "loading" | "success" | "error";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const json = await res.json();
      if (res.ok) {
        setState("success");
        setMsg(json.message || "You're on the list!");
        setEmail("");
      } else {
        setState("error");
        setMsg(json.error || "Something went wrong. Try again.");
      }
    } catch {
      setState("error");
      setMsg("Could not connect. Check your network and try again.");
    }
  }

  if (state === "success") {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="text-3xl">🎉</div>
        <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          {msg}
        </div>
        <div className="text-[12px] text-slate-500">
          We&apos;ll email you when Pro launches.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="flex-1 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0a0b10] px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-60 transition whitespace-nowrap"
      >
        {state === "loading" ? "Joining…" : "Join waitlist →"}
      </button>
      {state === "error" && (
        <p className="w-full text-center text-[12px] text-rose-500 mt-1">{msg}</p>
      )}
    </form>
  );
}
