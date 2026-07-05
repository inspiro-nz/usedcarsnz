import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getClientEnv } from "@/lib/env";

/**
 * Cookie-scoped Supabase client for Server Components / Actions.
 * Runs as `anon` or `authenticated` — every query is gated by RLS.
 * This is the DEFAULT client: use it unless you have a reason not to.
 */
export async function supabaseServer() {
  const env = getClientEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (all) => {
          try {
            all.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component render — middleware refreshes instead.
          }
        },
      },
    },
  );
}
