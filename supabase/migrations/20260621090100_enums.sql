-- ============================================================================
-- UsedCarsNZ · WP-1 · Migration 02 · Enumerated types
-- ----------------------------------------------------------------------------
-- Enums are used ONLY where the value set is genuinely closed and small, so the
-- database enforces the data quality the dashboards and filters depend on.
-- Open-ended descriptive fields (body type, colour, condition, import origin)
-- stay TEXT by design, to avoid migration churn as the catalogue grows.
-- ============================================================================

create type user_role        as enum ('buyer', 'dealer', 'staff', 'admin');
create type dealer_status     as enum ('pending', 'approved', 'suspended', 'rejected');
create type staff_role        as enum ('manager', 'sales');
create type seller_type       as enum ('dealer', 'private');
create type listing_status    as enum ('draft', 'active', 'paused', 'sold', 'expired');

-- Vehicle attributes with fixed, well-known value sets (strategy §9.3, §9.4).
create type fuel_type         as enum ('petrol', 'diesel', 'hybrid', 'phev', 'ev', 'other');
create type transmission_type as enum ('manual', 'automatic', 'other');
create type drive_type        as enum ('fwd', 'rwd', 'awd', '4wd');

-- Lead lifecycle (dealer-updatable enquiry status, strategy §9.5).
create type enquiry_status    as enum ('new', 'contacted', 'viewing_booked', 'sold', 'closed');

-- ---------- Lead-engine enums (the wedge) ----------
-- actor records WHO performed an action. The AI-vs-human distinction is exactly
-- what makes "the bot answered first, in under 60s" a measurable, auditable fact
-- (strategy §3): ai_first_response_sent by 'ai' vs a later reply_sent by 'human'.
create type lead_actor        as enum ('ai', 'human', 'system');

-- The funnel taxonomy. Eight events span enquiry -> sale and are sufficient to
-- compute median first-response time, enquiry->appointment, appointment->sale,
-- and time-on-market (strategy §9.2). See docs/SCHEMA_ERD_and_event_taxonomy.md.
create type lead_event_type   as enum (
  'enquiry_received',         -- a buyer enquiry created the lead (funnel entry)
  'ai_first_response_sent',   -- the AI's sub-60s first touch went out
  'qualification_completed',  -- buyer-side qualification finished (budget/finance/trade-in/timeline)
  'draft_created',            -- AI drafted a dealer reply (pending human approval, §7)
  'draft_approved',           -- a human approved/edited the draft (§7 audit point)
  'reply_sent',               -- the approved reply was sent to the buyer
  'viewing_booked',           -- a test drive / viewing was booked (the appointment)
  'marked_sold'               -- the vehicle was marked sold (conversion)
);

-- AI draft lifecycle for the human-approval audit trail (strategy §7).
create type ai_draft_status   as enum ('pending', 'approved', 'rejected', 'sent', 'discarded');
