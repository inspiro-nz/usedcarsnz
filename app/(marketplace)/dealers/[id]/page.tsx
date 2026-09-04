import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabasePublic } from "@/lib/supabase/public";
import type { DealerRow, ListingRow } from "@/lib/db/types";
import { ListingCard } from "@/components/marketplace/listing-card";
import { Badge, Empty } from "@/components/marketplace/ui";
import { listingPath, listingTitle } from "@/lib/format";

// Dynamic: a dealer's active stock changes as they list / pause / sell, and the
// cookie-less public client keeps this cheap. RLS (dealers_select) means anon
// only ever sees APPROVED dealers here — an unapproved/unknown id 404s.
//
// This page already reads through supabasePublic() and so is ISR-ready, but the
// conversion is deliberately deferred: MarketplaceHeader in the shared
// (marketplace) layout reads auth cookies via getViewer(), which forces every
// route beneath it dynamic at runtime under a production build. Adding
// `revalidate` here today would reproduce the listing-detail 500 rather than
// gain caching. Convert once that layout read is fixed.
export const dynamic = "force-dynamic";

interface Params {
  id: string;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://usedcarsnz.co.nz";
}

async function getDealer(id: string) {
  const sb = supabasePublic();
  // Only approved dealers are anon-readable (RLS) — a pending/unknown id returns
  // null here and we 404, so this page can never expose an unapproved dealer.
  const { data: dealer } = await sb
    .from("dealers")
    .select("*")
    .eq("id", id)
    .maybeSingle<DealerRow>();
  if (!dealer) return null;

  const { data: listings } = await sb
    .from("listings")
    .select("*")
    .eq("dealer_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60);

  return { dealer, listings: (listings ?? []) as ListingRow[] };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const found = await getDealer(id);
  if (!found) return { title: "Dealer not found" };
  const location = [found.dealer.suburb, found.dealer.city, found.dealer.region]
    .filter(Boolean)
    .join(", ");
  return {
    title: `${found.dealer.business_name} — cars for sale`,
    description: `Browse used cars from ${found.dealer.business_name}${
      location ? ` in ${location}` : ""
    } on UsedCarsNZ. Enquire and get a first response in under 60 seconds.`,
    alternates: { canonical: `${siteUrl()}/dealers/${found.dealer.id}` },
  };
}

export default async function DealerProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const found = await getDealer(id);
  if (!found) notFound();
  const { dealer, listings } = found;
  const location = [dealer.suburb, dealer.city, dealer.region]
    .filter(Boolean)
    .join(", ");

  // schema.org/AutoDealer JSON-LD. Every field is drawn from the dealer row or
  // live stock — nothing is inferred or padded, so an answer engine grounding on
  // this page gets the same facts a buyer sees. Absent fields are left undefined
  // and dropped by JSON.stringify rather than emitted empty.
  const hasAddress = Boolean(dealer.suburb || dealer.city || dealer.region);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    name: dealer.business_name,
    url: `${siteUrl()}/dealers/${dealer.id}`,
    telephone: dealer.phone ?? undefined,
    address: hasAddress
      ? {
          "@type": "PostalAddress",
          addressLocality: dealer.suburb ?? dealer.city ?? undefined,
          addressRegion: dealer.region ?? undefined,
          addressCountry: "NZ",
        }
      : undefined,
    makesOffer: listings.length
      ? listings.map((l) => ({
          "@type": "Offer",
          url: `${siteUrl()}${listingPath(l)}`,
          price: !l.is_poa && l.price_nzd != null ? l.price_nzd : undefined,
          priceCurrency: !l.is_poa && l.price_nzd != null ? "NZD" : undefined,
          availability: "https://schema.org/InStock",
          itemOffered: {
            "@type": "Car",
            name: listingTitle(l),
            brand: { "@type": "Brand", name: l.make },
            model: l.model,
            vehicleModelDate: String(l.year),
          },
        }))
      : undefined,
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="text-sm text-slate-500">Dealer</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {dealer.business_name}
        </h1>
        {dealer.verified ? <Badge tone="ok">Verified dealer</Badge> : null}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {location || "New Zealand"}
        {dealer.phone ? (
          <span className="tabular-nums"> · {dealer.phone}</span>
        ) : null}
      </p>
      <p className="tabular-nums mt-3 text-xs text-slate-500">
        {listings.length} car{listings.length === 1 ? "" : "s"} for sale · every
        enquiry answered in &lt;60s
      </p>

      <div className="mt-6">
        {listings.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} dealerName={dealer.business_name} />
            ))}
          </div>
        ) : (
          <Empty
            title="No cars listed right now"
            body={`${dealer.business_name} has no active listings at the moment — check back soon.`}
          />
        )}
      </div>
    </main>
  );
}
