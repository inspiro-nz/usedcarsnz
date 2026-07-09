import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/supabase/service";
import type { LeadEventRow } from "@/lib/db/types";
import type { LeadEventInput } from "@/lib/leads/types";

/**
 * The typed event-writer (session scope: schema + this library only — no UI,
 * no API routes). Every write goes through the log_lead_event RPC, the same
 * sanctioned, forge-proof append path lib/leads.ts already uses (ADR-0004);
 * this module exists so future call sites get a metadata shape checked
 * against the specific event_type at compile time, instead of the
 * Record<string, unknown> bag the original logEvent() helper accepts.
 */

/** Appends one immutable lead_events row. Returns the new event's id. */
export async function emitLeadEvent(input: LeadEventInput): Promise<string> {
  const svc = supabaseService();
  const { data, error } = await svc.rpc("log_lead_event", {
    p_lead_id: input.leadId,
    p_event_type: input.eventType,
    p_actor: input.actor,
    p_payload: input.metadata,
    ...(input.occurredAt ? { p_occurred_at: input.occurredAt } : {}),
  });
  if (error) {
    throw new Error(`emitLeadEvent(${input.eventType}): ${error.message}`);
  }
  return data as string;
}

/**
 * Reads a lead's full event timeline, oldest first. Uses the CALLER'S client
 * so RLS scopes the read to a dealer's own events (or admin) — the same
 * "authorize with RLS" pattern as lib/leads.ts's authorizeLeadAccess().
 */
export async function readTimeline(enquiryId: string): Promise<LeadEventRow[]> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("lead_events")
    .select("*")
    .eq("lead_id", enquiryId)
    .order("occurred_at", { ascending: true });
  if (error) {
    throw new Error(`readTimeline(${enquiryId}): ${error.message}`);
  }
  return (data ?? []) as LeadEventRow[];
}
