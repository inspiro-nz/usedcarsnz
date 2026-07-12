"use server";

import { revalidatePath } from "next/cache";
import { approveAndSendDraft, bookViewing, markSold } from "@/lib/leads";
import { supabaseServer } from "@/lib/supabase/server";

export interface ActionState {
  ok: boolean;
  error?: string;
}

// The public listing detail page is ISR-cached (revalidate = 300). Any listing
// mutation (create / status change / mark-sold) invalidates ALL listing-detail
// pages on demand so the demo never shows a stale price/status. Passing the
// route pattern with "page" revalidates every dynamic instance without having to
// reconstruct each listing's exact URL.
const LISTING_DETAIL_ROUTE = "/cars/[make]/[model]/[year]/[id]";
function revalidateListings() {
  revalidatePath(LISTING_DETAIL_ROUTE, "page");
}

export async function approveDraftAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await approveAndSendDraft({
      enquiryId: String(formData.get("enquiry_id")),
      draftId: String(formData.get("draft_id")),
      editedText: String(formData.get("reply_text") ?? ""),
    });
    revalidatePath("/dealer/leads");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function bookViewingAction(formData: FormData): Promise<void> {
  await bookViewing(String(formData.get("enquiry_id")));
  revalidatePath("/dealer/leads");
}

export async function markSoldAction(formData: FormData): Promise<void> {
  const raw = Number(formData.get("sold_price"));
  await markSold(
    String(formData.get("enquiry_id")),
    Number.isFinite(raw) && raw > 0 ? raw : null,
  );
  revalidatePath("/dealer/leads");
  revalidateListings(); // the sold listing's public page must reflect it
}

/** Create a listing AS THE CALLER — RLS proves dealer membership. */
export async function createListingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sb = await supabaseServer();
  const dealerId = String(formData.get("dealer_id"));
  const year = Number(formData.get("year"));
  const price = Number(formData.get("price_nzd"));

  const { error } = await sb.from("listings").insert({
    seller_type: "dealer",
    dealer_id: dealerId,
    make: String(formData.get("make") ?? "").trim(),
    model: String(formData.get("model") ?? "").trim(),
    year,
    variant: String(formData.get("variant") ?? "").trim() || null,
    body_type: String(formData.get("body_type") ?? "").trim() || null,
    fuel: String(formData.get("fuel") ?? "") || null,
    transmission: String(formData.get("transmission") ?? "") || null,
    odometer_km: Number(formData.get("odometer_km")) || null,
    colour: String(formData.get("colour") ?? "").trim() || null,
    price_nzd: Number.isFinite(price) && price > 0 ? price : null,
    is_poa: !(Number.isFinite(price) && price > 0),
    suburb: String(formData.get("suburb") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null,
    region: String(formData.get("region") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    // §7 compliance: dealer listings are in trade and must carry a CIN link.
    in_trade: true,
    cin_link:
      String(formData.get("cin_link") ?? "").trim() ||
      "https://usedcarsnz.co.nz/cin/pending",
    status: "active",
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dealer/listings");
  revalidateListings(); // surface the new listing on its public detail page
  return { ok: true };
}

export async function setListingStatusAction(formData: FormData): Promise<void> {
  const sb = await supabaseServer();
  const id = String(formData.get("listing_id"));
  const status = String(formData.get("status"));
  if (!["active", "paused"].includes(status)) return;
  await sb.from("listings").update({ status }).eq("id", id); // RLS-gated
  revalidatePath("/dealer/listings");
  revalidateListings(); // pause/reactivate must reflect on the public page
}
