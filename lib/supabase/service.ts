import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

/**
 * service_role client — BYPASSES RLS. Server-only by import guard.
 *
 * Rules of use (architecture.md §5, DECISIONS ADR-0004):
 *  - Never reachable from the browser; never in a Client Component.
 *  - Every call site must AUTHORIZE first (e.g. prove dealer membership via an
 *    RLS-scoped read) before doing privileged work.
 *  - lead_events writes go through the log_lead_event RPC — the sanctioned path.
 */
export function supabaseService() {
  const env = getServerEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — required for the lead engine.",
    );
  }
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
