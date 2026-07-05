-- ============================================================================
-- UsedCarsNZ · WP-1 · Migration 01 · Extensions
-- ----------------------------------------------------------------------------
-- pgvector powers semantic search (strategy §9.4). The embedding column is
-- PROVISIONED in this work package; the ANN index and the search itself are
-- deferred behind the Phase-2 conversion-lift gate — only the column lands now.
--
-- Extensions live in the `extensions` schema to match the WP-0 Supabase
-- convention (supabase/config.toml -> [api].extra_search_path = public,extensions).
-- pgcrypto guarantees gen_random_uuid() on any Postgres version.
-- ============================================================================

create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector   with schema extensions;
