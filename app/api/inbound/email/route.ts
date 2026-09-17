import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getServerEnv } from "@/lib/env";
import { supabaseService } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";
import { runFirstTouch } from "@/lib/enquiries/first-touch";
import {
  verifyInboundSignature,
  INBOUND_SIGNATURE_HEADER,
  INBOUND_TIMESTAMP_HEADER,
} from "@/lib/inbound/verify";
import { inboundPayloadSchema } from "@/lib/inbound/payload";
import { ingestInboundEmail, type InboundDb } from "@/lib/inbound/ingest";

export const dynamic = "force-dynamic";

/**
 * POST /api/inbound/email — the app side of the inbound-email lane (§5.3).
 *
 * The email-inbound Worker (workers/email-inbound) parses a forwarded Trade Me
 * / generic lead email, HMAC-signs a canonical JSON payload, and POSTs it here.
 * This endpoint authenticates the Worker (HMAC + timestamp), then runs the
 * SAME intake pipeline as the platform form via lib/inbound/ingest.ts +
 * lib/enquiries/first-touch.ts.
 *
 * It NEVER returns 5xx for a lead it merely can't route or parse — those are
 * 2xx/202 with a reason (see ingest) so the Worker doesn't retry into a storm.
 * 5xx is reserved for "we genuinely failed, please retry".
 */

const FOUNDER_NOTIFY_MAX_SKEW = 300;

async function notifyFounder(subject: string, text: string): Promise<void> {
  const env = getServerEnv();
  if (!env.FOUNDER_EMAIL) {
    console.warn(`[inbound:founder-notify no FOUNDER_EMAIL] ${subject} :: ${text}`);
    return;
  }
  try {
    await sendEmail({ to: env.FOUNDER_EMAIL, subject: `[UsedCarsNZ inbound] ${subject}`, text });
  } catch (err) {
    console.error("[inbound:founder-notify] send failed:", err);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const env = getServerEnv();

  // Fail CLOSED: with no shared secret we cannot authenticate the Worker, so we
  // refuse every request rather than accept unauthenticated writes. 503 (not
  // 401) tells the Worker this is our misconfiguration, retryable once fixed.
  if (!env.INBOUND_HMAC_SECRET) {
    console.error("[inbound] INBOUND_HMAC_SECRET is not set — refusing all inbound email.");
    return NextResponse.json({ ok: false, error: "inbound not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const verification = await verifyInboundSignature({
    rawBody,
    signatureHeader: request.headers.get(INBOUND_SIGNATURE_HEADER),
    timestampHeader: request.headers.get(INBOUND_TIMESTAMP_HEADER),
    secret: env.INBOUND_HMAC_SECRET,
    maxSkewSeconds: FOUNDER_NOTIFY_MAX_SKEW,
  });
  if (!verification.ok) {
    // Do not leak which check failed to an unauthenticated caller.
    console.warn(`[inbound] signature rejected: ${verification.reason}`);
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const payload = inboundPayloadSchema.safeParse(parsedJson);
  if (!payload.success) {
    return NextResponse.json(
      { ok: false, error: "invalid payload", issues: payload.error.issues.slice(0, 5) },
      { status: 400 },
    );
  }

  const svc = supabaseService();
  const { ctx } = await getCloudflareContext({ async: true });

  const result = await ingestInboundEmail(payload.data, {
    svc: svc as unknown as InboundDb,
    persistRaw: async (objectKey, rawEmail) => {
      const { error } = await svc.storage
        .from("inbound-email-raw")
        .upload(objectKey, new Blob([rawEmail], { type: "message/rfc822" }), {
          contentType: "message/rfc822",
          upsert: true,
        });
      if (error) throw new Error(`storage upload: ${error.message}`);
    },
    runFirstTouch,
    notifyFounder,
    waitUntil: (p) => ctx.waitUntil(p),
  });

  return NextResponse.json(result.body, { status: result.status });
}
