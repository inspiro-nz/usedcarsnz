import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import type { DealerRow, UserRow } from "@/lib/db/types";

/** The signed-in viewer: profile row + any dealer memberships. RLS-scoped. */
export interface Viewer {
  user: UserRow;
  dealers: DealerRow[];
  isAdmin: boolean;
}

export async function getViewer(): Promise<Viewer | null> {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data: profile } = await sb
    .from("users")
    .select("id, role, full_name, email")
    .eq("id", user.id)
    .single<UserRow>();
  if (!profile) return null;

  // Dealers the viewer can see beyond the public set = owned or staffed
  // (RLS makes non-approved dealers visible only to members/admin).
  const { data: dealers } = await sb
    .from("dealers")
    .select("*")
    .or(`owner_user_id.eq.${user.id}`)
    .order("created_at", { ascending: true });

  return {
    user: profile,
    dealers: (dealers ?? []) as DealerRow[],
    isAdmin: profile.role === "admin",
  };
}
