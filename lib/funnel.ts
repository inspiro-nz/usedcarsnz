import type { LeadEventRow } from "@/lib/db/types";

/**
 * Pure §9.2 funnel maths over lead_events rows. No IO, no server dependency —
 * unit-testable, and shared by the dealer dashboard and the public metric.
 * Formulas match SCHEMA_ERD_and_event_taxonomy.md §4.
 */

export interface FunnelMetrics {
  enquiries: number;
  firstResponses: number;
  medianFirstResponseSeconds: number | null;
  viewingsBooked: number;
  sold: number;
  enquiryToViewingRate: number | null;
  viewingToSaleRate: number | null;
}

export type FunnelEvent = Pick<
  LeadEventRow,
  "lead_id" | "event_type" | "occurred_at"
>;

export function computeFunnel(events: FunnelEvent[]): FunnelMetrics {
  const firstOf = new Map<string, Map<string, string>>(); // lead -> type -> first occurred_at
  for (const e of events) {
    let byType = firstOf.get(e.lead_id);
    if (!byType) {
      byType = new Map();
      firstOf.set(e.lead_id, byType);
    }
    if (!byType.has(e.event_type)) byType.set(e.event_type, e.occurred_at);
  }

  let enquiries = 0;
  let firstResponses = 0;
  let viewingsBooked = 0;
  let sold = 0;
  const responseSeconds: number[] = [];

  for (const byType of firstOf.values()) {
    const received = byType.get("enquiry_received");
    if (received) enquiries += 1;
    const responded = byType.get("ai_first_response_sent");
    if (responded) {
      firstResponses += 1;
      if (received) {
        responseSeconds.push(
          (new Date(responded).getTime() - new Date(received).getTime()) / 1000,
        );
      }
    }
    if (byType.has("viewing_booked")) viewingsBooked += 1;
    if (byType.has("marked_sold")) sold += 1;
  }

  return {
    enquiries,
    firstResponses,
    medianFirstResponseSeconds: median(responseSeconds),
    viewingsBooked,
    sold,
    enquiryToViewingRate: rate(viewingsBooked, enquiries),
    viewingToSaleRate: rate(sold, viewingsBooked),
  };
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function rate(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}
