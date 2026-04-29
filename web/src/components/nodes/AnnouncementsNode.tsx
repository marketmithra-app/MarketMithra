"use client";

import { Handle, Position } from "reactflow";
import type { BSEAnnouncement } from "@/lib/types";

export default function AnnouncementsNode({
  data,
}: {
  data: {
    announcements: BSEAnnouncement[] | null; // null = loading
    symbol: string;
  };
}) {
  const { announcements, symbol } = data;
  const isLoading = announcements === null;
  const isEmpty = Array.isArray(announcements) && announcements.length === 0;

  return (
    <div className="rounded-xl border border-slate-700 bg-[#11131c]/95 backdrop-blur px-3 pt-2 pb-3 w-[240px] shadow-lg shadow-slate-900/50 ring-1 ring-white/5">
      {/* Handle on top only — informational node, not a scoring input */}
      <Handle type="target" position={Position.Top} style={{ background: "#334155" }} />

      {/* Header */}
      <div className="flex items-center justify-between text-[13px] font-semibold text-slate-100 mb-2">
        <div className="flex items-center gap-1.5">
          <span>📋</span>
          <span>BSE Filings</span>
        </div>
        <span className="text-[9px] font-mono text-slate-500">{symbol}</span>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-2 bg-slate-800 rounded w-3/4 mb-1" />
              <div className="h-2 bg-slate-800 rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Empty / BSE down state */}
      {isEmpty && (
        <div className="text-[10px] text-slate-500 italic">No recent filings</div>
      )}

      {/* Announcement list */}
      {!isLoading && !isEmpty && announcements && (
        <ul className="space-y-2">
          {announcements.map((ann, i) => (
            <li key={i} className="border-t border-slate-800/60 pt-1.5 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-slate-500 font-mono">
                  {ann.date.slice(5)} · {ann.category}
                </span>
                {ann.impact === "high" && (
                  <span className="text-[8px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-1">
                    HIGH
                  </span>
                )}
                {ann.impact === "medium" && (
                  <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1">
                    MED
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-300 leading-snug">
                {ann.plainEnglish}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Footer */}
      <div className="pt-1.5 border-t border-slate-800/60 mt-2">
        <span className="text-[8px] text-slate-600 font-mono">bse · 6h cache</span>
      </div>
    </div>
  );
}
