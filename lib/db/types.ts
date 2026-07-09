/**
 * Row types for the WP-1 schema — hand-written, minimal, only the columns the
 * app reads or writes. Kept in one file so a schema migration has one place to
 * update. (Generated types via `supabase gen types` can replace this later.)
 */

export type UserRole = "buyer" | "dealer" | "staff" | "admin";
export type DealerStatus = "pending" | "approved" | "suspended" | "rejected";
export type SellerType = "dealer" | "private";
export type ListingStatus = "draft" | "active" | "paused" | "sold" | "expired";
export type FuelType = "petrol" | "diesel" | "hybrid" | "phev" | "ev" | "other";
export type TransmissionType = "manual" | "automatic" | "other";
export type EnquiryStatus =
  | "new"
  | "contacted"
  | "viewing_booked"
  | "sold"
  | "closed";
export type LeadActor = "ai" | "human" | "system";
export type LeadEventType =
  | "enquiry_received"
  | "ai_first_response_sent"
  | "qualification_completed"
  | "draft_created"
  | "draft_approved"
  | "reply_sent"
  | "viewing_booked"
  | "marked_sold"
  // Added in 20260707100000_lead_engine_enums.sql — additive, existing values above unchanged.
  | "ack_sent"
  | "ai_message_sent"
  | "buyer_message_received"
  | "qualification_updated"
  | "appointment_booked"
  | "lead_closed";
export type AiDraftStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "sent"
  | "discarded";
export type MessageSender = "buyer" | "ai" | "dealer";
export type DealerAliasSource = "trademe" | "generic";
export type EnquirySource = "platform_form" | "email_trademe" | "email_other";

export interface UserRow {
  id: string;
  role: UserRole;
  full_name: string | null;
  email: string | null;
}

export interface DealerRow {
  id: string;
  owner_user_id: string;
  business_name: string;
  nzbn: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  suburb: string | null;
  city: string | null;
  region: string | null;
  status: DealerStatus;
  verified: boolean;
  created_at: string;
}

export interface ListingRow {
  id: string;
  seller_type: SellerType;
  dealer_id: string | null;
  seller_user_id: string | null;
  make: string;
  model: string;
  year: number;
  variant: string | null;
  body_type: string | null;
  fuel: FuelType | null;
  transmission: TransmissionType | null;
  odometer_km: number | null;
  colour: string | null;
  wof_expiry: string | null;
  rego_expiry: string | null;
  import_origin: string | null;
  price_nzd: number | null;
  is_poa: boolean;
  suburb: string | null;
  city: string | null;
  region: string | null;
  title: string | null;
  description: string | null;
  in_trade: boolean;
  cin_link: string | null;
  status: ListingStatus;
  sold_price: number | null;
  sold_at: string | null;
  created_at: string;
}

export interface EnquiryRow {
  id: string;
  listing_id: string;
  dealer_id: string | null;
  seller_user_id: string | null;
  buyer_user_id: string | null;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string | null;
  message: string | null;
  qualification: Qualification | null;
  status: EnquiryStatus;
  source: EnquirySource;
  external_message_id: string | null;
  created_at: string;
}

/** Buyer-side pre-qualification snapshot (§9.1). Structured, never free text. */
export interface Qualification {
  budget_nzd?: number | null;
  finance?: "yes" | "no" | "unsure" | null;
  trade_in?: "yes" | "no" | null;
  timeline?: "this_week" | "this_month" | "browsing" | null;
}

export interface AiDraftRow {
  id: string;
  enquiry_id: string;
  dealer_id: string | null;
  seller_user_id: string | null;
  draft_text: string;
  edited_text: string | null;
  status: AiDraftStatus;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface LeadEventRow {
  id: string;
  lead_id: string;
  dealer_id: string | null;
  listing_id: string | null;
  event_type: LeadEventType;
  actor: LeadActor;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export interface MessageRow {
  id: string;
  enquiry_id: string;
  sender: MessageSender;
  body: string;
  created_at: string;
}

export interface DealerAliasRow {
  id: string;
  dealer_id: string;
  alias: string;
  source_hint: DealerAliasSource;
  active: boolean;
  created_at: string;
}
