"use client";

import { useState, useEffect } from "react";
import SignalCard from "@/components/SignalCard";
import StockCanvas from "@/components/StockCanvas";
import MobileIndicatorStack from "@/components/MobileIndicatorStack";
import ProUpgradeGate from "@/components/ProUpgradeGate";
import type { StockSnapshot } from "@/lib/types";
import { isAtCap, consumeOne } from "@/lib/usageCap";
import { saveLastSymbol } from "@/components/OpenAppButton";

export default function CanvasMain({
  snapshot,
  forceGate = false,
}: {
  snapshot: StockSnapshot;
  forceGate?: boolean;
}) {
  const [graphVisible, setGraphVisible] = useState(true);
  // null = not yet checked (SSR), true = show gate, false = show canvas
  const [gated, setGated] = useState<boolean | null>(null);

  useEffect(() => {
    // Must run client-side — localStorage is unavailable on the server.
    saveLastSymbol(snapshot.symbol);   // remember for "Open app →" on landing page
    if (forceGate || isAtCap()) {
      setGated(true);
    } else {
      consumeOne();   // charge one unit for this analysis
      setGated(false);
    }
  }, [snapshot.symbol, forceGate]);   // re-check whenever the user navigates to a new stock

  // While hydrating, render a neutral skeleton so there's no flash.
  if (gated === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-xs text-slate-600 animate-pulse font-mono">Loading…</div>
      </div>
    );
  }

  if (gated) {
    return <ProUpgradeGate symbol={snapshot.symbol} />;
  }

  return (
    <>
      <SignalCard
        snapshot={snapshot}
        graphVisible={graphVisible}
        onToggleGraph={() => setGraphVisible((v) => !v)}
      />
      {graphVisible && (
        <>
          {/* Desktop: ReactFlow canvas */}
          <div className="hidden md:block flex-1 min-h-0 relative">
            <StockCanvas snapshot={snapshot} />
          </div>
          {/* Mobile: vertical indicator stack */}
          <MobileIndicatorStack snapshot={snapshot} />
        </>
      )}
    </>
  );
}
