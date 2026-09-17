import { NextResponse, type NextRequest } from "next/server";
import { verifyCronRequest } from "@/lib/cron/auth";
import { sweepOutbox } from "@/lib/email/outbox";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron/outbox-sweep — retries the templated enquiry acks that failed
 * to send at enquiry time (email_outbox safe path, migration 15). Triggered by
 * the standalone Cron Worker workers/outbox-sweep on a schedule; the app worker
 * has no scheduled handler, so the cron cannot live on it.
 *
 * Delegates to sweepOutbox() (lib/email/outbox.ts) — the single, tested
 * implementation that also emits ack_sent once a retry actually reaches the
 * buyer. Nothing here auto-sends anything beyond re-attempting those queued acks.
 */
export async function POST(req: NextRequest) {
  const auth = verifyCronRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  try {
    const result = await sweepOutbox();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/outbox-sweep] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "sweep failed" },
      { status: 500 },
    );
  }
}
