import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { DealerRow, ListingRow } from "@/lib/db/types";
import { dateNZ, km, listingTitle, nzd } from "@/lib/format";
import { Badge } from "@/components/marketplace/ui";
import { EnquiryForm } from "@/app/(marketplace)/cars/enquiry-form";

export const dynamic = "force-dynamic";

interface Params {
  make: string;
  model: string;
  year: string;
  id: string;
}

async function getListing(id: string) {
  const sb = await supabaseServer();
  const { data: listing } = await sb
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle<ListingRow>();
  if (!listing) return null;

  let dealer: DealerRow | null = null;
  if (listing.dealer_id) {
    const { data } = await sb
      .from("dealers")
      .select("*")
      .eq("id", listing.dealer_id)
      .maybeSingle<DealerRow>();
    dealer = data;
  }
  return { listing, dealer };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const found = await getListing(id);
  if (!found) return { title: "Listing not found" };
  const t = listingTitle(found.listing);
  return {
    title: t,
    description: `${t} — ${nzd(found.listing.price_nzd, found.listing.is_poa)} on UsedCarsNZ. Enquire and get a first response in under 60 seconds.`,
  };
}

export default async function ListingPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const found = await getListing(id);
  if (!found) notFound();
  const { listing, dealer } = found;
  const title = listingTitle(listing);

  // schema.org/Car JSON-LD (§9.4)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: title,
    brand: { "@type": "Brand", name: listing.make },
    model: listing.model,
    vehicleModelDate: String(listing.year),
    mileageFromOdometer: listing.odometer_km
      ? {
          "@type": "QuantitativeValue",
          value: listing.odometer_km,
          unitCode: "KMT",
        }
      : undefined,
    offers:
      !listing.is_poa && listing.price_nzd != null
        ? {
            "@type": "Offer",
            price: listing.price_nzd,
            priceCurrency: "NZD",
            availability:
              listing.status === "active"
                ? "https://schema.org/InStock"
                : "https://schema.org/SoldOut",
          }
        : undefined,
  };

  const specs: [string, string][] = [
    ["Odometer", km(listing.odometer_km)],
    ["Fuel", listing.fuel ?? "—"],
    ["Transmission", listing.transmission ?? "—"],
    ["Body", listing.body_type ?? "—"],
    ["Colour", listing.colour ?? "—"],
    ["WOF expiry", dateNZ(listing.wof_expiry)],
    ["Rego expiry", dateNZ(listing.rego_expiry)],
    ["Import origin", listing.import_origin ?? "—"],
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          {/* Plate panel (photo pipeline is a later WP) */}
          <div className="flex h-64 items-center justify-center rounded-lg bg-slate-900 sm:h-80">
            <span className="text-6xl font-bold text-white/60">
              {`${listing.make[0] ?? ""}${listing.model[0] ?? ""}`.toUpperCase()}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {title}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {[listing.suburb, listing.city, listing.region]
                  .filter(Boolean)
                  .join(", ") || "New Zealand"}
              </p>
            </div>
            <p className="text-3xl font-bold tabular-nums text-slate-900">
              {nzd(listing.price_nzd, listing.is_poa)}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {listing.status !== "active" ? (
              <Badge tone="signal">{listing.status}</Badge>
            ) : null}
            {listing.seller_type === "dealer" ? (
              <>
                <Badge tone="ok">Dealer listing · answers &lt;60s</Badge>
                {dealer?.verified ? <Badge tone="ok">Verified dealer</Badge> : null}
              </>
            ) : (
              <Badge>Private seller</Badge>
            )}
          </div>

          {/* Spec sheet — the instrument panel */}
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl border border-slate-100 bg-white shadow-sm p-5 sm:grid-cols-4">
            {specs.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  {label}
                </dt>
                <dd className="tabular-nums mt-0.5 text-sm text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>

          {listing.description ? (
            <div className="mt-6">
              <h2 className="font-semibold text-slate-900">Seller&apos;s description</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {listing.description}
              </p>
            </div>
          ) : null}

          {/* Compliance strip (§7): in-trade disclosure + CIN link, always visible */}
          {listing.seller_type === "dealer" ? (
            <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-4 text-xs text-slate-500 shadow-sm">
              <p>
                This vehicle is offered <strong className="text-slate-900">in trade</strong> by{" "}
                {dealer?.business_name ?? "a registered motor vehicle trader"}.
                Consumer Guarantees Act and Fair Trading Act protections apply.
              </p>
              {listing.cin_link ? (
                <a
                  href={listing.cin_link}
                  className="mt-1 inline-block rounded font-medium text-slate-900 underline"
                >
                  View the Consumer Information Notice (CIN) for this vehicle
                </a>
              ) : null}
              <p className="mt-1">
                Vehicle details are seller-provided. Independent history checks
                are available via CarJam.
              </p>
            </div>
          ) : null}
        </div>

        {/* Enquiry rail */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          {listing.status === "active" ? (
            <EnquiryForm listingId={listing.id} />
          ) : (
            <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5 text-sm text-slate-500">
              This listing is no longer active
              {listing.status === "sold" ? " — it has sold." : "."}
            </div>
          )}
          {dealer ? (
            <div className="mt-4 rounded-2xl border border-slate-100 bg-white shadow-sm p-5 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Seller</p>
              <p className="mt-1 font-medium text-slate-900">{dealer.business_name}</p>
              <p className="text-slate-500">
                {[dealer.suburb, dealer.city].filter(Boolean).join(", ")}
              </p>
              {dealer.phone ? (
                <p className="tabular-nums mt-1 text-slate-900">{dealer.phone}</p>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
