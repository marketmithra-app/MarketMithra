"use client";

import { useEffect, useState } from "react";
import { getUser, type AuthUser } from "@/lib/auth";

const FREE_WEEKLY_CAP = 5;

export default function HeaderBadge() {
  const [user, setUser] = useState<AuthUser | null | "loading">("loading");
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    getUser().then((u) => {
      setUser(u);
      if (u && !u.isPro && !u.isAdmin) {
        try {
          const cached = sessionStorage.getItem("mm_usage_remaining");
          setRemaining(cached !== null ? parseInt(cached, 10) : FREE_WEEKLY_CAP);
        } catch {
          setRemaining(FREE_WEEKLY_CAP);
        }
      }
    });
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "mm_usage_remaining" && e.newValue !== null) {
        setRemaining(parseInt(e.newValue, 10));
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (user === "loading" || user === null) return null;

  if (user.isAdmin) {
    return (
      <span className="rounded-full bg-purple-500/20 border border-purple-500/40 px-2.5 py-1 text-[11px] font-semibold text-purple-400">
        Admin
      </span>
    );
  }

  if (user.isPro) {
    return (
      <span className="rounded-full bg-green-500/15 border border-green-500/40 px-2.5 py-1 text-[11px] font-semibold text-green-400">
        Pro
      </span>
    );
  }

  const rem = remaining ?? FREE_WEEKLY_CAP;
  const atCap = rem <= 0;

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] font-mono transition ${
        atCap
          ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
          : "border-slate-600 bg-slate-800/60 text-slate-400"
      }`}
      title={`Free tier: ${rem} of ${FREE_WEEKLY_CAP} analyses remaining this week`}
    >
      {atCap ? "Free · Resets Mon" : `Free · ${rem} left`}
    </span>
  );
}
