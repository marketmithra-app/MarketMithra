/**
 * Supabase client factories with graceful degradation.
 *
 * If NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are unset,
 * `getBrowserSupabase()` / `getServerSupabase()` return null. Callers must
 * handle the null case by falling back to localStorage (see JudgementBar).
 *
 * This lets us ship the judgement UX before the founder has provisioned
 * a Supabase project — the same code path lights up once env vars appear.
 *
 * For Stripe webhook writes (pro_subscribers, which bypasses RLS only for
 * service_role), use `getServiceSupabase()` with SUPABASE_SERVICE_ROLE_KEY.
 */
import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(URL && ANON);

let _browser: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (_browser) return _browser;
  _browser = createBrowserClient(URL!, ANON!);
  return _browser;
}

/** Server-side anon client. Pass cookie get/set from the Next.js request. */
export function getServerSupabase(cookies: {
  get: (name: string) => string | undefined;
  set?: (name: string, value: string, options?: Record<string, unknown>) => void;
}): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  return createServerClient(URL!, ANON!, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
      get: (name: string) => cookies.get(name),
      set: (name: string, value: string, options?: Record<string, unknown>) =>
        cookies.set?.(name, value, options),
    } as never,
  });
}

/**
 * Service-role client — bypasses RLS.
 * ONLY use in trusted server-side contexts (Stripe webhook, admin routes).
 * Never expose to the browser.
 */
export function getServiceSupabase(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !serviceKey) return null;
  return createClient(URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
