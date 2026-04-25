import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getServiceSupabase } from "@/lib/supabase";
import { buildDigestEmail } from "@/lib/email/digestTemplate";

export const runtime = "nodejs";

// Prevent this route from being cached at the CDN level.
export const dynamic = "force-dynamic";

interface DigestPreview {
  date: string;
  total_changes: number;
  buys: { symbol: string; name: string; prob: number; prev_verdict?: string }[];
  sells: { symbol: string; name: string; prob: number; prev_verdict?: string }[];
  holds: { symbol: string; name: string; prob: number; prev_verdict?: string }[];
}

/** Chunk an array into groups of `size`. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const secret = process.env.DIGEST_API_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as { date?: string; test_email?: string };
  const date = body.date ?? new Date().toISOString().slice(0, 10);
  const testEmail = body.test_email?.trim() ?? "";

  // ── Fetch digest preview from FastAPI ────────────────────────────────────────
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  let preview: DigestPreview;
  try {
    const res = await fetch(`${apiBase}/digest/preview?date=${date}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Backend returned ${res.status}` },
        { status: 502 }
      );
    }
    preview = (await res.json()) as DigestPreview;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown fetch error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }

  // ── Skip on flat days ────────────────────────────────────────────────────────
  if (preview.total_changes === 0) {
    return NextResponse.json(
      { ok: true, sent: 0, message: "No changes today — skipped" },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  // ── Load subscribers (test_email bypasses Supabase) ─────────────────────────
  let emails: string[];

  if (testEmail) {
    // Quick test mode — send to one address without touching Supabase
    emails = [testEmail];
    console.log("[digest/send] TEST MODE → sending to", testEmail);
  } else {
    const supabase = getServiceSupabase();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: "Supabase service client not configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data: rows, error: dbError } = await supabase
      .from("waitlist")
      .select("email");

    if (dbError) {
      return NextResponse.json(
        { ok: false, error: `Supabase error: ${dbError.message}` },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    emails = (rows ?? []).map((r: { email: string }) => r.email).filter(Boolean);
  }

  if (emails.length === 0) {
    return NextResponse.json(
      { ok: true, sent: 0, message: "No subscribers" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // ── Init Resend ──────────────────────────────────────────────────────────────
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { ok: false, error: "RESEND_API_KEY not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const resend = new Resend(resendKey);
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "digest@marketmithra.app";

  // ── Build email content ───────────────────────────────────────────────────────
  const { subject, html, text } = buildDigestEmail({
    date: preview.date,
    buys: preview.buys,
    sells: preview.sells,
    totalChanges: preview.total_changes,
  });

  // ── Send in batches of 10 ────────────────────────────────────────────────────
  const batches = chunk(emails, 10);
  let sent = 0;
  let failed = 0;
  let lastError = "";

  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map((email) =>
        resend.emails.send({
          from: fromEmail,
          to: email,
          subject,
          html: html.replace(/\{\{email\}\}/g, encodeURIComponent(email)),
          text: text.replace(/\{\{email\}\}/g, encodeURIComponent(email)),
        })
      )
    );

    for (const result of results) {
      if (result.status === "fulfilled" && !result.value.error) {
        sent++;
      } else {
        failed++;
        const reason =
          result.status === "rejected"
            ? result.reason
            : result.value.error;
        console.error("[digest/send] Email failed:", JSON.stringify(reason));
        lastError = typeof reason === "object" ? JSON.stringify(reason) : String(reason);
      }
    }
  }

  return NextResponse.json(
    { ok: sent > 0, sent, failed, date, ...(lastError ? { resend_error: lastError } : {}) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
