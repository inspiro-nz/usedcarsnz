import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { SIGNED_OUT, type ViewerSummary } from "@/lib/viewer-summary";

/**
 * Who is looking? — the auth read that used to live inside MarketplaceHeader.
 *
 * The (marketplace) layout wraps every marketplace page, including the two ISR
 * routes (listing detail, dealer storefront). Reading auth cookies during that
 * render forced those routes dynamic at runtime under a production build
 * ("Page changed from static to dynamic at runtime, reason: cookies" — a 500).
 * Moving the cookie read here, behind a client fetch, keeps the cached shell
 * cookie-free while the header still upgrades to the signed-in nav.
 *
 * Same trust boundary as before: getViewer() runs through supabaseServer(),
 * i.e. the caller's own session under RLS — never the service role. The
 * response is shape-only (booleans) so nothing new is exposed to the client.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer().catch(() => null);
  const body: ViewerSummary = viewer
    ? {
        signedIn: true,
        isDealer: viewer.dealers.length > 0,
        isAdmin: viewer.isAdmin,
      }
    : SIGNED_OUT;

  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
