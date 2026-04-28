"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import SignInGate from "@/components/gates/SignInGate";

function Controller() {
  const params = useSearchParams();
  const gate = params.get("gate");
  const symbol = params.get("symbol") ?? undefined;

  if (gate !== "canvas" && gate !== "signin") return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0b10]/70">
      <div className="relative h-full">
        <SignInGate symbol={symbol} />
      </div>
    </div>
  );
}

export default function LandingGateController() {
  return (
    <Suspense fallback={null}>
      <Controller />
    </Suspense>
  );
}
