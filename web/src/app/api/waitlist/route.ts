import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import fs from "fs";
import path from "path";

// Basic email validation
function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// File-based fallback when Supabase is not configured.
// Saves to data/waitlist.csv in the project root.
function saveToFile(email: string): boolean {
  try {
    const dir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "waitlist.csv");
    const line = `${new Date().toISOString()},${email}\n`;
    // avoid duplicates in file
    if (fs.existsSync(file)) {
      const existing = fs.readFileSync(file, "utf-8");
      if (existing.includes(email)) return true; // already exists
    }
    fs.appendFileSync(file, line);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // Try Supabase first (service role — waitlist inserts don't need user auth)
  const supabase = getServiceSupabase();
  if (supabase) {
    const { error } = await supabase
      .from("waitlist")
      .upsert({ email }, { onConflict: "email" });

    if (error) {
      // Table might not exist yet — fall through to file
      console.warn("Supabase waitlist insert failed:", error.message);
    } else {
      return NextResponse.json({
        ok: true,
        persisted: "supabase",
        message: "You're on the list! We'll email you at launch.",
      });
    }
  }

  // Fallback: save to local file
  const saved = saveToFile(email);
  if (saved) {
    return NextResponse.json({
      ok: true,
      persisted: "file",
      message: "You're on the list! We'll email you at launch.",
    });
  }

  return NextResponse.json({ error: "Could not save. Try again." }, { status: 500 });
}
