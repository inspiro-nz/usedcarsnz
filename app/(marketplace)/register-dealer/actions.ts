"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { checkRateLimit, getClientIP } from "@/lib/security";

export interface RegisterState {
  ok: boolean;
  error?: string;
}

/**
 * Dealer self-registration. Inserted AS THE CALLER: RLS requires
 * owner_user_id = auth.uid(), and the DB guard forces status=pending /
 * verified=false regardless of what's submitted (ADR-0007). Approval is a
 * manual admin step (§9.6).
 */
export async function registerDealer(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const ip = await getClientIP();
  if (!checkRateLimit(ip, { scope: "dealer-register", windowMs: 60 * 60 * 1000, max: 3 })) {
    return { ok: false, error: "Too many registration attempts — please try again later." };
  }

  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/sign-in");

  const businessName = String(formData.get("business_name") ?? "").trim();
  const nzbn = String(formData.get("nzbn") ?? "").trim();
  if (!businessName) return { ok: false, error: "Business name is required." };

  const { error } = await sb.from("dealers").insert({
    owner_user_id: user.id,
    business_name: businessName,
    nzbn: nzbn || null,
    contact_name: String(formData.get("contact_name") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    suburb: String(formData.get("suburb") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null,
    region: String(formData.get("region") ?? "").trim() || null,
  });

  if (error) {
    return {
      ok: false,
      error: error.message.includes("dealers_nzbn_key")
        ? "A dealership with that NZBN is already registered."
        : "Registration failed — please check the details and try again.",
    };
  }
  return { ok: true };
}
