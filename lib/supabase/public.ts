import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getClientEnv } from "@/lib/env";

/**
 * Cookie-LESS anonymous Supabase client for PUBLIC, cacheable reads.
 *
 * supabaseServer() reads cookies (for auth), and any cookies() access forces a
 * route into dynamic rendering — which would defeat ISR. The public listing
 * index/detail pages show only anon-readable data, so they use this client
 * instead: it runs as the anon role (RLS still applies) but touches no request
 * state, so pages that use it can be statically rendered / ISR-cached.
 *
 * Uses only NEXT_PUBLIC_* config (no secret), so it is safe to evaluate at build
 * time as well as at runtime.
 */
export function supabasePublic() {
  const env = getClientEnv();
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
