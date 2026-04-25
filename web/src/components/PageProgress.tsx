"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Thin amber progress bar at the top of the page.
 * Animates on every route change — gives instant visual feedback.
 */
export default function PageProgress() {
  const pathname = usePathname();
  const [progress, setProgress]   = useState(0);
  const [visible, setVisible]     = useState(false);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPath  = useRef(pathname);

  useEffect(() => {
    if (pathname === prevPath.current) return;
    prevPath.current = pathname;

    // Start animation
    setProgress(0);
    setVisible(true);

    // Quickly animate to 90%, then hold
    const steps = [15, 30, 50, 70, 85, 92];
    steps.forEach((p, i) => {
      timerRef.current = setTimeout(() => setProgress(p), i * 80);
    });

    // Complete after a short hold
    const done = setTimeout(() => {
      setProgress(100);
      setTimeout(() => setVisible(false), 300);
    }, 600);

    return () => {
      steps.forEach(() => clearTimeout(timerRef.current!));
      clearTimeout(done);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 z-[9999] h-[3px] bg-amber-400 transition-all duration-150 ease-out pointer-events-none"
      style={{ width: `${progress}%`, opacity: progress === 100 ? 0 : 1 }}
    />
  );
}
