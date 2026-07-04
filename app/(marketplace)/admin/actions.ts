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
