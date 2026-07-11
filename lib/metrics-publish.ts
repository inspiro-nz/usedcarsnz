/**
 * Pure §9.2 metric shaping — types, the minimum-N publish gate, the 30-day
 * first-response distribution strip, and CSV export. No IO, no server import, so
 * this is unit-testable in isolation and shared by the dashboard, the public
 * page, and GET /api/metrics. The SQL views are the single source of the numbers
 * (lib/metrics-views.ts); this file only shapes and gates what they return.
 */

/** The published-claim floor (§9.2 honesty / FTA discipline). Below this many
 * measured first responses the platform metric is NOT published as a number —
 * the public page shows "insufficient data" instead of a hollow claim. */
export const MIN_PUBLISH_N = 20;

export interface FirstResponseBuckets {
  under1m: number;
  m1to5: number;
  m5to30: number;
  m30to60: number;
  h1to4: number;
  over4h: number;
  total: number;
}

/** The six-bucket strip, in display order, with a label and count each. */
export const BUCKET_ORDER: {
  key: keyof Omit<FirstResponseBuckets, "total">;
  label: string;
}[] = [
  { key: "under1m", label: "<1m" },
  { key: "m1to5", label: "1–5m" },
  { key: "m5to30", label: "5–30m" },
  { key: "m30to60", label: "30–60m" },
  { key: "h1to4", label: "1–4h" },
  { key: "over4h", label: ">4h" },
];

export interface DealerMetrics {
  dealerId: string | null;
  enquiries: number;
  firstResponses: number;
  medianFirstResponseSeconds: number | null;
  p90FirstResponseSeconds: number | null;
  appointments: number;
  sold: number;
  enquiryToAppointmentRate: number | null;
  appointmentToSoldRate: number | null;
  medianDaysOnMarket: number | null;
  soldListings: number;
  /** Enquiries per listing in the most recent month with activity (v5.1 §12.2). */
  enquiriesPerListing: number | null;
  firstResponse30d: FirstResponseBuckets;
}

export interface PlatformMetrics {
  enquiries: number;
  firstResponses: number;
  medianFirstResponseSeconds: number | null;
  p90FirstResponseSeconds: number | null;
  appointments: number;
  sold: number;
  enquiryToAppointmentRate: number | null;
  appointmentToSoldRate: number | null;
  medianDaysOnMarket: number | null;
  soldListings: number;
  enquiriesPerListing: number | null;
}

export interface PublishedPlatformMetric {
  /** True iff the event log substantiates the claim (firstResponses >= MIN_PUBLISH_N). */
  sufficient: boolean;
  minN: number;
  metrics: PlatformMetrics;
}

/**
 * The publish gate: the public page must never publish a first-response claim the
 * log can't substantiate. Below MIN_PUBLISH_N measured first responses,
 * `sufficient` is false and the page shows "insufficient data".
 */
export function applyPublishGate(metrics: PlatformMetrics): PublishedPlatformMetric {
  return {
    sufficient: metrics.firstResponses >= MIN_PUBLISH_N,
    minN: MIN_PUBLISH_N,
    metrics,
  };
}

/** CSV-quote a field iff it contains a comma, quote, or newline (RFC 4180). */
function csvCell(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_COLUMNS: { header: string; get: (m: DealerMetrics) => string | number | null }[] = [
  { header: "dealer_id", get: (m) => m.dealerId },
  { header: "enquiries", get: (m) => m.enquiries },
  { header: "first_responses", get: (m) => m.firstResponses },
  { header: "median_first_response_seconds", get: (m) => m.medianFirstResponseSeconds },
  { header: "p90_first_response_seconds", get: (m) => m.p90FirstResponseSeconds },
  { header: "appointments", get: (m) => m.appointments },
  { header: "sold", get: (m) => m.sold },
  { header: "enquiry_to_appointment_rate", get: (m) => m.enquiryToAppointmentRate },
  { header: "appointment_to_sold_rate", get: (m) => m.appointmentToSoldRate },
  { header: "median_days_on_market", get: (m) => m.medianDaysOnMarket },
  { header: "enquiries_per_listing", get: (m) => m.enquiriesPerListing },
];

/**
 * §9.2 CSV export. One row per dealer (a dealer exports their single row; an
 * admin exports every dealer). No client-side maths — the values come straight
 * from the views. Uses CRLF line endings per RFC 4180 for spreadsheet fidelity.
 */
export function dealerMetricsToCsv(rows: DealerMetrics[]): string {
  const lines = [CSV_COLUMNS.map((c) => c.header).join(",")];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((c) => csvCell(c.get(row))).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
