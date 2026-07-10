import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/supabase/service";
import { checkRateLimit, getClientIP, honeypotTripped } from "@/lib/security";
import { verifyTurnstile } from "@/lib/turnstile";
import { runFirstTouch } from "@/lib/enquiries/first-touch";
import type { ListingRow } from "@/lib/db/types";

/**
 * POST /api/enquiries — the marketplace's buyer-enquiry intake (strategy
 * §7 compliance envelope). The first touch here is a TEMPLATED
 * acknowledgement sent synchronously and deterministically — no LLM in the
 * path, so the sub-60s SLA never depends on model latency or availability.
 * AI qualification is handed off via ctx.waitUntil(triggerQualification(...))
 * as a stub this session; a later session implements it for real.
 *
 * Security posture mirrors the frozen app/api/lead/route.ts (honeypot,
 * IP rate limit, Turnstile, HTML-escaped email content) but imports the
 * shared implementations from lib/security.ts rather than reimplementing
 * them inline — see lib/turnstile.ts and lib/sanitize.ts for the two pieces
 * lib/security.ts doesn't (yet) export, added as new modules because
 * lib/security.ts itself is frozen (invariant 2).
 */

const bodySchema = z.object({
  listing_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().max(4000).optional().or(z.literal("")),
  token: z.string().min(1, "Security verification failed"),
  website: z.string().optional(), // honeypot
});

export async function POST(request: NextRequest) {
  const ip = await getClientIP();
  if (!checkRateLimit(ip, { scope: "enquiries-api", windowMs: 60 * 60 * 1000, max: 10 })) {
    return NextResponse.json(
      { error: "Too many enquiries from this connection — please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request format." }, { status: 400 });
  }

  // Honeypot — silently "succeed" so bots aren't told they were caught
  // (same posture as /api/lead and the prior cars/actions.ts server action).
  const honeypotValue = (raw as { website?: string } | null)?.website ?? null;
  if (honeypotTripped(honeypotValue)) {
    return NextResponse.json({ ok: true });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Please check your details and try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const data = parsed.data;

  const turnstileOk = await verifyTurnstile(data.token, ip);
  if (!turnstileOk) {
    return NextResponse.json({ error: "Security verification failed. Please try again." }, { status: 400 });
  }

  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  // Insert AS THE CALLER (anon or signed-in) so RLS is the gate — only
  // ACTIVE listings accept enquiries, and dealer_id is set server-side by
  // the DB trigger, never from this request.
  const { data: enquiry, error: insertError } = await sb
    .from("enquiries")
    .insert({
      listing_id: data.listing_id,
      buyer_user_id: user?.id ?? null,
      buyer_name: data.name,
      buyer_email: data.email,
      buyer_phone: data.phone || null,
      message: data.message || null,
      source: "platform_form",
    })
    .select("id, created_at")
    .single<{ id: string; created_at: string }>();

  if (insertError || !enquiry) {
    return NextResponse.json(
      { error: "That enquiry couldn't be sent — the listing may no longer be active." },
      { status: 400 },
    );
  }

  // enquiry_received is auto-logged by the enquiries_logged DB trigger — not
  // re-emitted here.

  const svc = supabaseService();
  const { data: listing } = await svc
    .from("listings")
    .select("*")
    .eq("id", data.listing_id)
    .single<ListingRow>();

  let dealerName: string | null = null;
  let dealerLogoUrl: string | null = null;
  let dealerEmail: string | null = null;
  if (listing?.dealer_id) {
    const { data: dealer } = await svc
      .from("dealers")
      .select("business_name, email, logo_url")
      .eq("id", listing.dealer_id)
      .single<{ business_name: string; email: string | null; logo_url: string | null }>();
    dealerName = dealer?.business_name ?? null;
    dealerEmail = dealer?.email ?? null;
    dealerLogoUrl = dealer?.logo_url ?? null;
  }

  // The templated ack + qualification hand-off is the SHARED first touch,
  // identical to the inbound-email lane (lib/enquiries/first-touch.ts). Awaited
  // so the ack send/queue completes before we respond; qualification is
  // scheduled via ctx.waitUntil inside it.
  const { ctx } = await getCloudflareContext({ async: true });
  await runFirstTouch({
    enquiry: { id: enquiry.id, created_at: enquiry.created_at },
    buyer: { name: data.name, email: data.email },
    dealer: { name: dealerName, email: dealerEmail, logoUrl: dealerLogoUrl },
    channel: "email",
    waitUntil: (p) => ctx.waitUntil(p),
  });

  return NextResponse.json({
    ok: true,
    enquiryId: enquiry.id,
    respondedInMs: Date.now() - new Date(enquiry.created_at).getTime(),
  });
}
