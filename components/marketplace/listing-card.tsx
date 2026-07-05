import Link from "next/link";
import type { ListingRow } from "@/lib/db/types";
import { km, listingPath, listingTitle, nzd } from "@/lib/format";
import { Badge } from "@/components/marketplace/ui";

/**
 * Listing card. No photo pipeline yet (Storage wiring is a later WP), so the
 * visual is an honest plate: make/model monogram on a slate-900 panel — the
 * same dark panel the homepage hero uses.
 */
export function ListingCard({ listing }: { listing: ListingRow }) {
  const monogram =
    `${listing.make[0] ?? ""}${listing.model[0] ?? ""}`.toUpperCase();
  return (
    <Link
      href={listingPath(listing)}
      className="group block overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all hover:border-orange-100 hover:shadow-md"
    >
      <div className="flex h-36 items-center justify-center bg-slate-900">
        <span className="text-4xl font-bold text-white/60">{monogram}</span>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug text-slate-900 group-hover:underline">
            {listingTitle(listing)}
          </h3>
        </div>
        <p className="text-lg font-bold tabular-nums text-slate-900">
          {nzd(listing.price_nzd, listing.is_poa)}
        </p>
        <p className="text-xs tabular-nums text-slate-500">
          {km(listing.odometer_km)}
          {listing.fuel ? ` · ${listing.fuel}` : ""}
          {listing.transmission ? ` · ${listing.transmission}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {listing.city ? <Badge>{listing.city}</Badge> : null}
          {listing.seller_type === "dealer" ? (
            <Badge tone="ok">Dealer · answers &lt;60s</Badge>
          ) : (
            <Badge>Private</Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
