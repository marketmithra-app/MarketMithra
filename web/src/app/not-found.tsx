import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0b10] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400 to-fuchsia-500 grid place-items-center text-3xl font-black text-slate-900">
        M
      </div>
      <div className="text-6xl font-black font-mono text-slate-200 dark:text-slate-800 mb-3">
        404
      </div>
      <h1 className="text-xl font-bold mb-2">Page not found</h1>
      <p className="text-sm text-slate-500 mb-8 max-w-xs">
        This signal doesn&apos;t exist — or the ticker moved. Try the canvas or the signals index.
      </p>
      <div className="flex items-center gap-3">
        <Link
          href="/canvas"
          className="rounded-full bg-amber-400 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300 transition"
        >
          Open canvas →
        </Link>
        <Link
          href="/signals"
          className="rounded-full border border-slate-300 dark:border-slate-700 px-5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
        >
          All signals
        </Link>
      </div>
    </div>
  );
}
