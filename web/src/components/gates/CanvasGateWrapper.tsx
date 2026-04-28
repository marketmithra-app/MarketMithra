"use client";

import { useEffect, useState } from "react";
import { consumeAnalysis, type UsageResult } from "@/lib/usageCap";
import CapGate from "@/components/gates/CapGate";

interface Props {
  symbol: string;
  children: React.ReactNode;
}

export default function CanvasGateWrapper({ symbol, children }: Props) {
  const [result, setResult] = useState<UsageResult | null>(null);

  useEffect(() => {
    consumeAnalysis(symbol).then((r) => {
      setResult(r);
      // Share remaining count with HeaderBadge via sessionStorage.
      try {
        sessionStorage.setItem("mm_usage_remaining", String(r.remaining));
        window.dispatchEvent(new StorageEvent("storage", {
          key: "mm_usage_remaining",
          newValue: String(r.remaining),
        }));
      } catch { /* ignore */ }
    });
  }, [symbol]);

  // While cap check is in flight, render children (fast path — fail open).
  if (result === null) return <>{children}</>;

  if (!result.allowed) {
    return (
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div aria-hidden="true" className="pointer-events-none select-none opacity-30 flex-1">
          {children}
        </div>
        <div className="absolute inset-0">
          <CapGate resetAt={result.resetAt} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
