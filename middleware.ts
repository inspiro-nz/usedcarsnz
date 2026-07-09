import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase auth session refresh (standard @supabase/ssr pattern).
 *
 * NOTE ON THE FILE NAME: Next 16 renames `middleware` to `proxy`, but
 * `proxy.ts` always runs on the Node.js runtime, which the
 * @opennextjs/cloudflare adapter (v1.19) rejects — it requires EDGE
 * middleware. The deprecated-but-supported `middleware.ts` convention still
 * compiles to edge middleware, which is exactly what the Cloudflare Workers
 * deploy needs. Rename to proxy.ts once the adapter supports it.
 *
 * SCOPE: the matcher below lists ONLY marketplace routes. `/` (the Founding
 * Dealer landing page) and `/api/lead` are deliberately not matched, so their
 * request path — including every security control on the lead route — is
 * byte-for-byte identical to before this file existed.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return response; // env not wired yet — no-op

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (all) => {
        all.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        all.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser(); // refresh the session if expired
  return response;
}

export const config = {
  matcher: [
    "/account",
    "/reset-password",
    "/cars/:path*",
    "/dealer/:path*",
    "/admin/:path*",
    "/register-dealer",
    "/sign-in",
    "/sign-up",
  ],
};
