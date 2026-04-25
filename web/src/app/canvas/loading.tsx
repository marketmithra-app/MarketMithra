/**
 * Shown during server-side fetch when navigating to a new stock.
 * Matches the canvas layout so there's no layout shift.
 */
export default function CanvasLoading() {
  return (
    <div className="flex flex-col h-screen bg-white text-slate-900 dark:bg-[#0a0b10] dark:text-slate-100">
      {/* top bar skeleton */}
      <div className="flex items-center justify-between gap-3 px-3 md:px-5 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-400 to-fuchsia-500 grid place-items-center text-[15px] font-black text-slate-900">
            M
          </div>
          <div className="leading-tight hidden sm:block">
            <div className="text-base font-bold tracking-tight">MarketMithra</div>
          </div>
        </div>
        <div className="flex-1 max-w-xl">
          <div className="h-9 rounded-full bg-slate-100 dark:bg-[#11131c] border border-slate-300 dark:border-slate-700 animate-pulse" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-7 w-20 rounded-full bg-slate-800/60 animate-pulse" />
          <div className="h-7 w-16 rounded-full bg-slate-800/60 animate-pulse" />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* sidebar skeleton */}
        <aside className="w-[280px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0c0e16] hidden md:flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="h-4 w-32 rounded bg-slate-700/40 animate-pulse mb-1.5" />
            <div className="h-3 w-40 rounded bg-slate-700/30 animate-pulse" />
          </div>
          <div className="flex-1 overflow-hidden">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 border-l-2 border-transparent">
                <div className="w-4 h-2 rounded bg-slate-700/40 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className={`h-2.5 rounded bg-slate-700/60 animate-pulse ${i % 3 === 0 ? "w-20" : "w-14"}`} />
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1 rounded-full bg-slate-800 animate-pulse" />
                    <div className="w-7 h-2 rounded bg-slate-800 animate-pulse shrink-0" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* main canvas skeleton */}
        <main className="flex-1 min-h-0 flex items-center justify-center">
          <div className="text-xs text-slate-600 dark:text-slate-600 font-mono animate-pulse">
            Fetching signal…
          </div>
        </main>
      </div>
    </div>
  );
}
