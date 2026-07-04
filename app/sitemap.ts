import type { MetadataRoute } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { listingPath } from "@/lib/format";
import type { ListingRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://usedcarsnz.co.nz";
  const entries: MetadataRoute.Sitemap = [
    { url: site, changeFrequency: "hourly", priority: 1 },
    { url: `${site}/cars`, changeFrequency: "hourly", priority: 0.9 },
  ];
  try {
    const sb = await supabaseServer();
    const { data } = await sb
      .from("listings")
      .select("id, make, model, year, created_at")
      .eq("status", "active")
      .limit(5000);
    for (const l of (data ?? []) as Pick<ListingRow, "id" | "make" | "model" | "year" | "created_at">[]) {
      entries.push({
        url: `${site}${listingPath(l)}`,
        lastModified: l.created_at,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  } catch {
    // env not wired — base entries only
  }
  return entries;
}
