import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Lands here from every Supabase auth email link (signup confirmation,
 * password recovery, invite) with a `?code=...` PKCE param. Exchanges it for
 * a session (setting the cookies) then forwards to `next`, never leaving the
 * raw code sitting in the address bar.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/account";

  if (code) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth-callback-failed`);
}
