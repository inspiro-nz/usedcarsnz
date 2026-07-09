import type { LeadActor, LeadEventType, Qualification } from "@/lib/db/types";

/**
 * One metadata shape per lead_event_type (strategy §9.2 taxonomy), so
 * emitLeadEvent() rejects a payload that doesn't match its event at compile
 * time. Mirrors the enum in supabase/migrations/20260621090100_enums.sql and
 * its additions in 20260707100000_lead_engine_enums.sql; LeadEventType itself
 * stays the single source of truth in lib/db/types.ts.
 */

export interface EnquiryReceivedMeta {
  source: "platform_form" | "email_trademe" | "email_other";
  has_message: boolean;
}

/** Templated auto-ack only (compliance envelope, strategy §7) — never vehicle-aware text. */
export interface AckSentMeta {
  channel: "email" | "sms";
  template: string;
  /** Server-measured enquiry_received -> ack_sent latency, for the SLA metric. */
  ms_since_received?: number;
  /** True when the ack only sent via the email_outbox retry sweep, not the original request. */
  via_outbox_retry?: boolean;
}

export interface AiFirstResponseSentMeta {
  channel: "email" | "sms";
}

export interface AiMessageSentMeta {
  channel: "email" | "sms" | "chat";
  message_id?: string;
}

export interface BuyerMessageReceivedMeta {
  channel: "email" | "sms" | "chat";
  message_id?: string;
}

export type QualificationCompletedMeta = Qualification;
export type QualificationUpdatedMeta = Qualification;

export interface DraftCreatedMeta {
  draft_id: string;
}

export interface DraftApprovedMeta {
  draft_id: string;
  approved_by: string;
  edited?: boolean;
}

export interface ReplySentMeta {
  draft_id?: string;
  channel: "email" | "sms";
}

export interface AppointmentBookedMeta {
  scheduled_at?: string;
  notes?: string;
}

export interface MarkedSoldMeta {
  sold_price?: number;
}

export interface LeadClosedMeta {
  reason?: string;
}

interface LeadEventMetaMap {
  enquiry_received: EnquiryReceivedMeta;
  ack_sent: AckSentMeta;
  ai_first_response_sent: AiFirstResponseSentMeta;
  ai_message_sent: AiMessageSentMeta;
  buyer_message_received: BuyerMessageReceivedMeta;
  qualification_completed: QualificationCompletedMeta;
  qualification_updated: QualificationUpdatedMeta;
  draft_created: DraftCreatedMeta;
  draft_approved: DraftApprovedMeta;
  reply_sent: ReplySentMeta;
  // viewing_booked is the original name, appointment_booked its successor
  // (20260707100000_lead_engine_enums.sql keeps both — no rename of shipped data).
  viewing_booked: AppointmentBookedMeta;
  appointment_booked: AppointmentBookedMeta;
  marked_sold: MarkedSoldMeta;
  lead_closed: LeadClosedMeta;
}

// Compile-time proof every LeadEventType has a metadata entry above: fails to
// typecheck if a new enum value is added to LeadEventType without a matching
// key here.
type _AssertEveryEventTypeMapped = LeadEventType extends keyof LeadEventMetaMap
  ? true
  : never;
const _assertEveryEventTypeMapped: _AssertEveryEventTypeMapped = true;
void _assertEveryEventTypeMapped;

/** Discriminated union input for emitLeadEvent(): metadata is typed per eventType. */
export type LeadEventInput = {
  [K in LeadEventType]: {
    leadId: string;
    eventType: K;
    actor: LeadActor;
    metadata: LeadEventMetaMap[K];
    /** Defaults to now() in the DB (log_lead_event) when omitted. */
    occurredAt?: string;
  };
}[LeadEventType];
