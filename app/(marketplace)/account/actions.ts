"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/supabase/service";

/**
 * Deletes the caller's own account via the Admin API (auth.users delete
 * cascades to public.users, saved_listings, staff_accounts; sets
 * enquiries.buyer_user_id to NULL). Blocked while the caller still owns a
 * dealer (dealers.owner_user_id is ON DELETE RESTRICT) — they need to
 * transfer or wind down the dealership first.
 */
export async function deleteAccountAction() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: dealers } = await sb
    .from("dealers")
    .select("id")
    .eq("owner_user_id", user.id)
    .limit(1);
  if (dealers && dealers.length > 0) {
    redirect("/account?error=owns-dealer");
  }

  const { error } = await supabaseService().auth.admin.deleteUser(user.id);
  if (error) {
    redirect("/account?error=delete-failed");
  }

  await sb.auth.signOut();
  redirect("/sign-in?deleted=1");
}
