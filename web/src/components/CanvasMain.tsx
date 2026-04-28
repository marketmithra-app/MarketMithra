"use client";

import { useState, useEffect } from "react";
import SignalCard from "@/components/SignalCard";
import StockCanvas from "@/components/StockCanvas";
import MobileIndicatorStack from "@/components/MobileIndicatorStack";
import type { StockSnapshot } from "@/lib/types";
import { saveLastSymbol } from "@/components/OpenAppButton";

export default function CanvasMain({
  snapshot,
  forceGate = false,
}: {
  snapshot: StockSnapshot;
  forceGate?: boolean;
}) {
  const [graphVisible, setGraphVisible] = useState(true);
  useEffect(() => {
    // Must run client-side — localStorage is unavailable on the server.
    saveLastSymbol(snapshot.symbol);   // remember for "Open app →" on landing page
  }, [snapshot.symbol]);

  // Gating is handled by CanvasGateWrapper (server-side weekly cap).
  // CanvasMain always renders the full canvas when mounted.
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
