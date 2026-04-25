import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unsubscribe · MarketMithra",
  robots: { index: false },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; email?: string }>;
}) {
  const { status, email } = await searchParams;

  const done    = status === "done";
  const invalid = status === "invalid";
  const error   = status === "error";

  return (
    <div className="min-h-screen bg-[#080a12] flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="text-5xl mb-6">
          {done ? "✅" : invalid ? "⚠️" : error ? "❌" : "📧"}
        </div>

        {done && (
          <>
            <h1 className="text-2xl font-black text-slate-100 mb-3">
              You&apos;re unsubscribed
            </h1>
            <p className="text-slate-400 text-sm mb-2">
              {email ? (
                <><span className="text-slate-300">{decodeURIComponent(email)}</span> has been removed from the MarketMithra digest.</>
              ) : (
                "Your email has been removed from the MarketMithra digest."
              )}
            </p>
            <p className="text-slate-600 text-xs mb-8">
              You won&apos;t receive any more daily signal emails.
            </p>
          </>
        )}

        {invalid && (
          <>
            <h1 className="text-2xl font-black text-slate-100 mb-3">Invalid link</h1>
            <p className="text-slate-400 text-sm mb-8">
              This unsubscribe link is missing an email address. If you&apos;d like to
              unsubscribe, reply to any digest email and we&apos;ll remove you manually.
            </p>
          </>
        )}

        {error && (
          <>
            <h1 className="text-2xl font-black text-slate-100 mb-3">Something went wrong</h1>
            <p className="text-slate-400 text-sm mb-8">
              We couldn&apos;t process your request. Please try again or reply to the email
              and we&apos;ll remove you manually.
            </p>
          </>
        )}

        {!status && (
          <>
            <h1 className="text-2xl font-black text-slate-100 mb-3">Unsubscribe</h1>
            <p className="text-slate-400 text-sm mb-8">
              Click the unsubscribe link in any MarketMithra digest email to stop receiving
              daily signal updates.
            </p>
          </>
        )}

        <Link
          href="/"
          className="inline-block rounded-full bg-amber-400 text-slate-900 font-bold text-sm px-6 py-2.5 hover:bg-amber-300 transition"
        >
          Back to MarketMithra
        </Link>
      </div>
    </div>
  );
}
