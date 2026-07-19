-- NEGATIVE CONTROL - DO NOT MERGE (PROMPT-T2 proof).
-- Simulates a careless migration weakening the immutable log: drops ONE of
-- the three prevent_mutation triggers. tests/db-invariants must turn CI red.
drop trigger lead_events_no_update on public.lead_events;
