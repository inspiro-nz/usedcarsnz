"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Admin approves a dealer. Runs AS THE ADMIN through RLS: the dealers UPDATE
 * policy and the guard trigger both allow status changes for admins only —
 * no service_role needed here.
 */
export async function approveDealerAction(formData: FormData): Promise<void> {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return;

  const id = String(formData.get("dealer_id"));
  await sb
    .from("dealers")
    .update({
      status: "approved",
      verified: true,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/admin");
}

export async function rejectDealerAction(formData: FormData): Promise<void> {
  const sb = await supabaseServer();
  const id = String(formData.get("dealer_id"));
  await sb.from("dealers").update({ status: "rejected" }).eq("id", id);
  revalidatePath("/admin");
}

/**
 * Admin pulls an already-approved dealer off the platform — a complaint, a
 * compliance issue, anything short of outright rejection. `suspended`
 * existed in the dealer_status enum from the start but was never wired into
 * any code path, so there was previously no way to do this at all short of
 * editing the database directly.
 *
 * Also pauses every currently-active listing: dealers_select/listings_select
 * RLS only hides the dealer's own storefront row on suspension (dealer_status
 * plays no part in listings_select), so without this a suspended dealer's
 * stock would keep showing up in browse/search and on its own listing pages.
 * Runs AS THE ADMIN (not service_role) — both dealers_update and
 * listings_update grant is_admin() in their RLS policies, same posture as
 * approveDealerAction/rejectDealerAction above.
 */
export async function suspendDealerAction(formData: FormData): Promise<void> {
  const sb = await supabaseServer();
  const id = String(formData.get("dealer_id"));
  await sb.from("dealers").update({ status: "suspended" }).eq("id", id);
  await sb.from("listings").update({ status: "paused" }).eq("dealer_id", id).eq("status", "active");
  revalidatePath("/admin");
  // The now-paused listings are ISR-cached (revalidate=300 on both routes) —
  // invalidate on demand rather than waiting out the window, same pattern as
  // dealer/actions.ts's revalidateListings() for the equivalent single-listing pause.
  revalidatePath("/cars/[make]/[model]/[year]/[id]", "page");
  revalidatePath("/dealers/[id]", "page");
}

/**
 * Admin reactivates a suspended dealer. Deliberately does NOT auto-reactivate
 * the listings suspendDealerAction paused — there's no reliable way to tell
 * which were paused by suspension versus already paused by the dealer's own
 * choice beforehand, and a dealer coming back from suspension should review
 * their stock before it goes live again anyway. They reactivate individual
 * listings the normal way (setListingStatusAction, dealer/listings page).
 */
export async function reactivateDealerAction(formData: FormData): Promise<void> {
  const sb = await supabaseServer();
  const id = String(formData.get("dealer_id"));
  await sb.from("dealers").update({ status: "approved" }).eq("id", id);
  revalidatePath("/admin");
}
