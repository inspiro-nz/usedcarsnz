-- ============================================================================
-- UsedCarsNZ · WP-1.1 · Migration 09 · Lead-engine enum extensions
-- ----------------------------------------------------------------------------
-- Additive only: existing enum values are never removed or renamed (migration
-- 20260621090100_enums.sql already shipped and lib/leads.ts / lib/db/types.ts
-- depend on the original vocabulary). This file only ADDS new enum types and
-- new lead_event_type values needed for the buyer/AI/dealer message thread,
-- the draft->approved audit trail, and email-based lead intake (trademe/generic
-- aliasing), per docs/AUDIT-LEAD-ENGINE.md findings 3 and 4.
--
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction as a
-- statement that reads the new value (Postgres restriction), and Supabase
-- applies each migration file as a single multi-statement query, i.e. a single
-- implicit transaction. This file therefore ONLY adds enum values/types; no
-- later statement in THIS file references them. Later migration files may
-- reference them freely once this file has committed.
-- ============================================================================

-- ---------- dealer_aliases.source_hint ----------
-- Distinguishes an inbound-email alias minted for a TradeMe reply-to address
-- from a generic dealer-issued alias (docs/AUDIT-LEAD-ENGINE.md §4).
create type public.dealer_alias_source as enum ('trademe', 'generic');

-- ---------- messages.sender ----------
-- The buyer/AI/dealer chat thread (a message "lands" here only via the
-- approved-draft send path for dealer free text — enforced in application
-- code, not the DB, since messages itself has no draft/approval state).
create type public.message_sender as enum ('buyer', 'ai', 'dealer');

-- ---------- enquiries.source ----------
-- Where the lead originated: the marketplace form, or an inbound email routed
-- through a dealer alias (TradeMe reply-to vs a generic forwarding address).
create type public.enquiry_source as enum ('platform_form', 'email_trademe', 'email_other');

-- ---------- lead_event_type: new funnel/audit events ----------
-- Existing values (enquiry_received, ai_first_response_sent,
-- qualification_completed, draft_created, draft_approved, reply_sent,
-- viewing_booked, marked_sold) are untouched. These new values cover the
-- compliance envelope's draft/ack distinction (strategy §7) and the chat
-- thread / terminal-close states the messages and dealer_aliases tables add.
alter type public.lead_event_type add value if not exists 'ack_sent';                 -- templated auto-ack (compliance envelope, §7)
alter type public.lead_event_type add value if not exists 'ai_message_sent';          -- AI chat message beyond the initial ack
alter type public.lead_event_type add value if not exists 'buyer_message_received';   -- inbound buyer reply on the thread
alter type public.lead_event_type add value if not exists 'qualification_updated';    -- incremental qualification change (vs. qualification_completed's final snapshot)
alter type public.lead_event_type add value if not exists 'appointment_booked';       -- viewing_booked's successor name; both kept, no rename of shipped data
alter type public.lead_event_type add value if not exists 'lead_closed';              -- terminal non-sale close (enquiry_status already has 'closed'; no matching event existed)
