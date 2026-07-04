import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { computeFunnel, type FunnelEvent, type FunnelMetrics } from "@/lib/funnel";

export { computeFunnel };
export type { FunnelMetrics };

/**
 * The dealer's §9.2 metrics, read with the CALLER'S client so RLS scopes it:
 * a dealer computes over their own events only.
 */
export async function dealerFunnelMetrics(): Promise<FunnelMetrics> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("lead_events")
    .select("lead_id, event_type, occurred_at")
    .order("occurred_at", { ascending: true });
  if (error) throw new Error(`lead_events read: ${error.message}`);
  return computeFunnel((data ?? []) as FunnelEvent[]);
}
