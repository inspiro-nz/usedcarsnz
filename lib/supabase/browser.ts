"use client";

import { createBrowserClient } from "@supabase/ssr";

const authNotConfigured = async () => ({
  data: null,
  error: { message: "Sign-in is not configured in this environment." },
});

function createNoopBrowserClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithPassword: authNotConfigured,
      signUp: authNotConfigured,
      resetPasswordForEmail: authNotConfigured,
      updateUser: authNotConfigured,
    },
  } as unknown as ReturnType<typeof createBrowserClient>;
}

/**
 * Browser client (anon key). Used only by auth forms.
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY directly
 * from process.env rather than via getClientEnv() — that shared validator also
 * checks unrelated public vars (e.g. Turnstile) and throwing there must never
 * turn "Supabase is configured" into a broken auth client.
 */
export function supabaseBrowser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return createNoopBrowserClient();
  }

  return createBrowserClient(supabaseUrl, publishableKey);
}
