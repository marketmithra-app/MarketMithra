/**
 * Client-side auth helpers — thin wrappers around Supabase auth.
 *
 * Works gracefully when Supabase is not configured:
 *   - signIn() → returns { error: "Supabase not configured" }
 *   - signOut() → clears localStorage Pro flag and returns
 *   - getUser() → returns null
 */
import { getBrowserSupabase } from "@/lib/supabase";

export type AuthUser = {
  id: string;
  email: string;
  isPro: boolean;
};

/**
 * Send a magic-link email.
 * Returns { error: string | null }.
 */
export async function signInWithEmail(
  email: string,
  redirectTo = `${window.location.origin}/auth/callback`
): Promise<{ error: string | null }> {
  const supabase = getBrowserSupabase();
  if (!supabase) {
    return { error: "Auth not configured — add Supabase keys to .env.local" };
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  return { error: error?.message ?? null };
}

/**
 * Sign out and clear local Pro flag.
 */
export async function signOut(): Promise<void> {
  const supabase = getBrowserSupabase();
  if (supabase) await supabase.auth.signOut();
  try {
    localStorage.removeItem("mm_pro");
    localStorage.removeItem("mm_pro_email");
  } catch { /* ignore */ }
}

/**
 * Get the current user + Pro status. Returns null if not signed in.
 * Checks Supabase `pro_subscribers` table to determine Pro.
 */
export async function getUser(): Promise<AuthUser | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  // Check Pro status from DB.
  let isPro = false;
  try {
    const { data } = await supabase
      .from("pro_subscribers")
      .select("id")
      .eq("email", user.email)
      .maybeSingle();
    isPro = !!data;
  } catch { /* table may not exist yet */ }

  // Sync localStorage so the usage cap reads it without a DB call.
  try {
    if (isPro) localStorage.setItem("mm_pro", "1");
  } catch { /* ignore */ }

  return { id: user.id, email: user.email, isPro };
}
