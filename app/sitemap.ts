import type { MetadataRoute } from "next";
import { supabasePublic } from "@/lib/supabase/public";
import { listingPath } from "@/lib/format";
import type { DealerRow, ListingRow } from "@/lib/db/types";

// Cookie-less public client: the sitemap is anon-readable data only, so it must
// not touch request state (supabaseServer() reads cookies, which is what forced
// this route to force-dynamic before). Revalidated hourly — new stock appears
// within the hour without regenerating on every crawler hit.
export const revalidate = 3600;

const PAGE_LIMIT = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://usedcarsnz.co.nz";
  const entries: MetadataRoute.Sitemap = [
    { url: site, changeFrequency: "hourly", priority: 1 },
    { url: `${site}/cars`, changeFrequency: "hourly", priority: 0.9 },
  ];

  try {
    const sb = supabasePublic();

    // Listings. Paged rather than a bare limit(5000) so growth past the cap
    // surfaces as more URLs instead of silently truncating the sitemap.
    for (let from = 0; from < 50_000; from += PAGE_LIMIT) {
      const { data } = await sb
        .from("listings")
        .select("id, make, model, year, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_LIMIT - 1);

      const rows = (data ?? []) as Pick<
        ListingRow,
        "id" | "make" | "model" | "year" | "created_at"
      >[];
      for (const l of rows) {
        entries.push({
          url: `${site}${listingPath(l)}`,
          lastModified: l.created_at,
          changeFrequency: "daily",
          priority: 0.7,
        });
      }
      if (rows.length < PAGE_LIMIT) break;
    }

    // Dealer storefronts. RLS exposes only approved dealers to anon, so this
    // cannot leak a pending registration. These are durable, locally-specific
    // pages — exactly the surface the AEO strategy is aimed at — and were
    // previously absent from the sitemap entirely.
    const { data: dealers } = await sb
      .from("dealers")
      .select("id, created_at")
      .order("created_at", { ascending: true })
      .limit(PAGE_LIMIT);

    for (const d of (dealers ?? []) as Pick<DealerRow, "id" | "created_at">[]) {
      entries.push({
        url: `${site}/dealers/${d.id}`,
        lastModified: d.created_at,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  } catch {
    // env not wired — base entries only
  }

  return entries;
}
