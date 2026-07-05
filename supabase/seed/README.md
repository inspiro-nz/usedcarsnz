# Seed data

**Policy: dev and demo only. Production is never seeded.**

- `seed.sql` holds synthetic, non-production rows.
- Local applies it automatically on `supabase start` and `supabase db reset`
  (see `[db.seed]` in `../config.toml`).
- Dev/Demo apply it explicitly via [`../../scripts/seed-remote.sh`](../../scripts/seed-remote.sh),
  which hard-refuses anything other than the `dev` or `demo` target.

Empty at WP-0 (no schema yet). Demo seed content lands with the schema work
package: roughly 3 dealers, 30 listings, sample enquiries across lead states,
and royalty-free placeholder photos.
