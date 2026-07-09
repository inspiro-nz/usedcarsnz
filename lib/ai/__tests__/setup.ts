// Minimum env for lib/env.ts's required fields; everything AI-related has a
// default in the schema, so tests exercise real default resolution.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "test-anon-key";
