import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import type {
  DealerMetrics,
  FirstResponseBuckets,
  PlatformMetrics,
} from "@/lib/metrics-publish";

/**
 * Server-side read layer over the §9.2 metric VIEWS (migration 19). Every number
 * originates in lead_events and is computed by the views — this file only reads
 * them and coerces the wire types. No metric maths happens here (the views are
 * the single source, per the brief).
 *
 * RLS does the scoping: the dealer views are security_invoker, so
 * supabaseServer() (the caller's cookie-scoped client) returns a dealer their
 * OWN row and an admin every row. The platform view is aggregate-only and
 * readable by anon.
 */

/** numeric columns arrive from PostgREST as strings; bigint/double as numbers. */
function num(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}
function numOrNull(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v);
}

interface DealerHeadlineRow {
  dealer_id: string | null;
  enquiries: number | string;
  first_responses: number | string;
  median_first_response_seconds: number | string | null;
  p90_first_response_seconds: number | string | null;
  appointments: number | string;
  sold: number | string;
  enquiry_to_appointment_rate: number | string | null;
  appointment_to_sold_rate: number | string | null;
}

interface BucketRow {
  dealer_id: string | null;
  b0_under_1m: number | string;
  b1_1_5m: number | string;
  b2_5_30m: number | string;
  b3_30_60m: number | string;
  b4_1_4h: number | string;
  b5_over_4h: number | string;
  total: number | string;
}

const EMPTY_BUCKETS: FirstResponseBuckets = {
  under1m: 0,
  m1to5: 0,
  m5to30: 0,
  m30to60: 0,
  h1to4: 0,
  over4h: 0,
  total: 0,
};

function bucketsFromRow(row: BucketRow | null): FirstResponseBuckets {
  if (!row) return EMPTY_BUCKETS;
  return {
    under1m: num(row.b0_under_1m),
    m1to5: num(row.b1_1_5m),
    m5to30: num(row.b2_5_30m),
    m30to60: num(row.b3_30_60m),
    h1to4: num(row.b4_1_4h),
    over4h: num(row.b5_over_4h),
    total: num(row.total),
  };
}

function dealerMetricsFromRows(
  headline: DealerHeadlineRow | null,
  tom: { median_days_on_market: number | string | null; sold_listings: number | string } | null,
  epl: { enquiries_per_listing: number | string | null } | null,
  buckets: BucketRow | null,
): DealerMetrics {
  return {
    dealerId: headline?.dealer_id ?? null,
    enquiries: num(headline?.enquiries),
    firstResponses: num(headline?.first_responses),
    medianFirstResponseSeconds: numOrNull(headline?.median_first_response_seconds),
    p90FirstResponseSeconds: numOrNull(headline?.p90_first_response_seconds),
    appointments: num(headline?.appointments),
    sold: num(headline?.sold),
    enquiryToAppointmentRate: numOrNull(headline?.enquiry_to_appointment_rate),
    appointmentToSoldRate: numOrNull(headline?.appointment_to_sold_rate),
    medianDaysOnMarket: numOrNull(tom?.median_days_on_market),
    soldListings: num(tom?.sold_listings),
    enquiriesPerListing: numOrNull(epl?.enquiries_per_listing),
    firstResponse30d: bucketsFromRow(buckets),
  };
}

/**
 * One dealer's own §9.2 metrics for the dashboard. Four view reads in parallel
 * (each a single indexed aggregate). RLS already scopes a plain dealer to their
 * own rows, but the explicit dealer_id filter also disambiguates the case where
 * the caller is an admin (RLS would return every dealer's row), keeping each
 * read single-row. Reads the most recent month for the enquiries-per-listing
 * kill number.
 */
export async function dealerMetrics(dealerId: string): Promise<DealerMetrics> {
  const sb = await supabaseServer();
  const [headline, tom, epl, buckets] = await Promise.all([
    sb
      .from("metrics_dealer")
      .select("*")
      .eq("dealer_id", dealerId)
      .maybeSingle<DealerHeadlineRow>(),
    sb
      .from("metrics_time_on_market_dealer")
      .select("median_days_on_market, sold_listings")
      .eq("dealer_id", dealerId)
      .maybeSingle<{ median_days_on_market: number | string | null; sold_listings: number | string }>(),
    sb
      .from("metrics_enquiries_per_listing_dealer")
      .select("enquiries_per_listing")
      .eq("dealer_id", dealerId)
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle<{ enquiries_per_listing: number | string | null }>(),
    sb
      .from("metrics_first_response_30d_dealer")
      .select("*")
      .eq("dealer_id", dealerId)
      .maybeSingle<BucketRow>(),
  ]);

  const firstError = headline.error ?? tom.error ?? epl.error ?? buckets.error;
  if (firstError) throw new Error(`metrics read: ${firstError.message}`);

  return dealerMetricsFromRows(headline.data, tom.data, epl.data, buckets.data);
}

/**
 * Every dealer's headline row (admin only — RLS returns all rows to an admin,
 * one row to a dealer). Powers the admin aggregate + CSV export. Reads the
 * headline view only; the per-dealer detail views are dashboard concerns.
 */
export async function allDealerMetrics(): Promise<DealerMetrics[]> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("metrics_dealer")
    .select("*")
    .order("enquiries", { ascending: false })
    .returns<DealerHeadlineRow[]>();
  if (error) throw new Error(`metrics read: ${error.message}`);
  return (data ?? []).map((row) => dealerMetricsFromRows(row, null, null, null));
}

interface PlatformRow {
  enquiries: number | string;
  first_responses: number | string;
  median_first_response_seconds: number | string | null;
  p90_first_response_seconds: number | string | null;
  appointments: number | string;
  sold: number | string;
  enquiry_to_appointment_rate: number | string | null;
  appointment_to_sold_rate: number | string | null;
  median_days_on_market: number | string | null;
  sold_listings: number | string;
  enquiries_per_listing: number | string | null;
}

/**
 * The platform aggregate (public page + admin). Aggregate-only view, readable by
 * anon. The caller applies the minimum-N publish gate (applyPublishGate).
 */
export async function platformMetrics(): Promise<PlatformMetrics> {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("metrics_platform")
    .select("*")
    .maybeSingle<PlatformRow>();
  if (error) throw new Error(`platform metrics read: ${error.message}`);

  return {
    enquiries: num(data?.enquiries),
    firstResponses: num(data?.first_responses),
    medianFirstResponseSeconds: numOrNull(data?.median_first_response_seconds),
    p90FirstResponseSeconds: numOrNull(data?.p90_first_response_seconds),
    appointments: num(data?.appointments),
    sold: num(data?.sold),
    enquiryToAppointmentRate: numOrNull(data?.enquiry_to_appointment_rate),
    appointmentToSoldRate: numOrNull(data?.appointment_to_sold_rate),
    medianDaysOnMarket: numOrNull(data?.median_days_on_market),
    soldListings: num(data?.sold_listings),
    enquiriesPerListing: numOrNull(data?.enquiries_per_listing),
  };
}

/** True when the demo environment flag is set — drives the "Sample data" badge. */
export function isSampleData(): boolean {
  return process.env.DEMO_SAMPLE_DATA === "1" ||
    process.env.DEMO_SAMPLE_DATA?.toLowerCase() === "true";
}
