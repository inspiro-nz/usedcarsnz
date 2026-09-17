import { NextResponse, type NextRequest } from "next/server";
import { verifyCronRequest } from "@/lib/cron/auth";
import { closeStaleLeads } from "@/lib/leads";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron/close-stale-leads — auto-closes leads the buyer has gone
 * quiet on for 7+ days as "not sold" (closeStaleLeads(), lib/leads.ts).
 * Triggered by the standalone Cron Worker workers/close-stale-leads (the app
 * worker has no scheduled handler — docs/architecture.md invariant 1).
 */
export async function POST(req: NextRequest) {
  const auth = verifyCronRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  try {
    const result = await closeStaleLeads();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/close-stale-leads] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "close-stale-leads failed" },
      { status: 500 },
    );
  }
}
