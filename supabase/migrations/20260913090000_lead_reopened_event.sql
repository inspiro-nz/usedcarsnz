-- ============================================================================
-- UsedCarsNZ · lead_event_type: add 'lead_reopened'
-- ----------------------------------------------------------------------------
-- 'closed' (enquiry_status) and 'lead_closed' (lead_event_type) already existed
-- from 20260621090100_enums.sql / 20260707100000_lead_engine_enums.sql but were
-- never wired into any code path — a dealer had no way to close a lead as "not
-- sold", and nothing ever transitioned a lead into 'closed' at all.
--
-- This session wires both up (lib/leads.ts closeLead/reopenLead/closeStaleLeads):
-- a dealer can manually close a lead, a daily cron auto-closes leads with no
-- buyer reply after 7 days (skipping viewing_booked/sold/closed), and any new
-- buyer message on a closed lead reopens it automatically. 'lead_closed' already
-- existed for the first two; this migration adds the missing reverse event.
--
-- Per the append-only design (migration 06 prevent_mutation), reopening is
-- NEVER a mutation of the original 'lead_closed' event — it is a new event
-- appended alongside it, same as every other correction in this schema.
-- ============================================================================

alter type public.lead_event_type add value if not exists 'lead_reopened';
