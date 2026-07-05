"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { runFirstTouch } from "@/lib/leads";
import { checkRateLimit, getClientIP, honeypotTripped } from "@/lib/security";
import type { Qualification } from "@/lib/db/types";

export interface EnquiryFormState {
  ok: boolean;
  error?: string;
  respondedInSeconds?: number;
}

/**
 * Creates the enquiry AS THE CALLER (anon or signed-in) so RLS is the gate:
 * inserts are only allowed on ACTIVE listings, and dealer_id is set server-side
 * by the DB trigger — never from this form. Then the lead engine runs the
 * instant first touch and drafts the dealer reply (§9.1).
 */
export async function submitEnquiry(
  _prev: EnquiryFormState,
  formData: FormData,
): Promise<EnquiryFormState> {
  // Abuse protection — same honeypot + IP rate-limit posture as /api/lead.
  if (honeypotTripped(formData.get("website"))) {
    // Silently "succeed" so bots aren't told they were caught.
    return { ok: true, respondedInSeconds: 1 };
  }
  const ip = await getClientIP();
  if (!checkRateLimit(ip, { scope: "enquiry", windowMs: 60 * 60 * 1000, max: 10 })) {
    return { ok: false, error: "Too many enquiries from this connection — please try again later." };
  }

  const listingId = String(formData.get("listing_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!listingId || !name || !email) {
    return { ok: false, error: "Name and email are required." };
  }

  const qualification: Qualification = {
    budget_nzd: numOrNull(formData.get("budget_nzd")),
    finance: strOrNull(formData.get("finance")) as Qualification["finance"],
    trade_in: strOrNull(formData.get("trade_in")) as Qualification["trade_in"],
    timeline: strOrNull(formData.get("timeline")) as Qualification["timeline"],
  };

  const started = Date.now();
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  const { data: enquiry, error } = await sb
    .from("enquiries")
    .insert({
      listing_id: listingId,
      buyer_user_id: user?.id ?? null,
      buyer_name: name,
      buyer_email: email,
      buyer_phone: phone || null,
      message: message || null,
      qualification,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !enquiry) {
    return {
      ok: false,
      error:
        "That enquiry couldn't be sent — the listing may no longer be active.",
    };
  }

  try {
    await runFirstTouch(enquiry.id);
  } catch (err) {
    // The enquiry exists and the dealer will see it; first-touch failure is
    // logged, not shown as a buyer-facing error.
    console.error("[lead-engine] first touch failed:", err);
  }

  return {
    ok: true,
    respondedInSeconds: Math.max(1, Math.round((Date.now() - started) / 1000)),
  };
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return v && !Number.isNaN(n) && n > 0 ? n : null;
}
function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}
