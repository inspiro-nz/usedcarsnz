import { describe, it, expect } from "vitest";
import {
  applyPublishGate,
  dealerMetricsToCsv,
  MIN_PUBLISH_N,
  BUCKET_ORDER,
  type DealerMetrics,
  type PlatformMetrics,
} from "@/lib/metrics-publish";

const platform = (over: Partial<PlatformMetrics>): PlatformMetrics => ({
  enquiries: 0,
  firstResponses: 0,
  medianFirstResponseSeconds: null,
  p90FirstResponseSeconds: null,
  appointments: 0,
  sold: 0,
  enquiryToAppointmentRate: null,
  appointmentToSoldRate: null,
  medianDaysOnMarket: null,
  soldListings: 0,
  enquiriesPerListing: null,
  ...over,
});

describe("applyPublishGate — minimum-N honesty", () => {
  it("is INSUFFICIENT below the threshold", () => {
    const r = applyPublishGate(platform({ firstResponses: MIN_PUBLISH_N - 1, medianFirstResponseSeconds: 45 }));
    expect(r.sufficient).toBe(false);
    expect(r.minN).toBe(MIN_PUBLISH_N);
  });

  it("is SUFFICIENT at exactly the threshold", () => {
    const r = applyPublishGate(platform({ firstResponses: MIN_PUBLISH_N, medianFirstResponseSeconds: 45 }));
    expect(r.sufficient).toBe(true);
  });

  it("never mutates the metrics it gates", () => {
    const m = platform({ firstResponses: 5 });
    expect(applyPublishGate(m).metrics).toEqual(m);
  });
});

const dealer = (over: Partial<DealerMetrics>): DealerMetrics => ({
  dealerId: "d1",
  enquiries: 10,
  firstResponses: 10,
  medianFirstResponseSeconds: 52,
  p90FirstResponseSeconds: 88,
  appointments: 4,
  sold: 2,
  enquiryToAppointmentRate: 0.4,
  appointmentToSoldRate: 0.5,
  medianDaysOnMarket: 31,
  soldListings: 2,
  enquiriesPerListing: 3.5,
  firstResponse30d: { under1m: 8, m1to5: 1, m5to30: 1, m30to60: 0, h1to4: 0, over4h: 0, total: 10 },
  ...over,
});

describe("dealerMetricsToCsv", () => {
  it("emits a header + one row per dealer, nulls as empty cells", () => {
    const csv = dealerMetricsToCsv([
      dealer({ dealerId: "d1" }),
      dealer({ dealerId: "d2", medianFirstResponseSeconds: null, enquiriesPerListing: null }),
    ]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      "dealer_id,enquiries,first_responses,median_first_response_seconds,p90_first_response_seconds,appointments,sold,enquiry_to_appointment_rate,appointment_to_sold_rate,median_days_on_market,enquiries_per_listing",
    );
    expect(lines[1].startsWith("d1,10,10,52,88,4,2,0.4,0.5,31,3.5")).toBe(true);
    // null median + null enquiries_per_listing render as empty fields
    expect(lines[2]).toBe("d2,10,10,,88,4,2,0.4,0.5,31,");
  });

  it("RFC-4180-quotes a value containing a comma", () => {
    const csv = dealerMetricsToCsv([dealer({ dealerId: "a,b" })]);
    expect(csv.split("\r\n")[1].startsWith('"a,b",')).toBe(true);
  });
});

describe("BUCKET_ORDER", () => {
  it("covers all six latency buckets in ascending order", () => {
    expect(BUCKET_ORDER.map((b) => b.key)).toEqual([
      "under1m",
      "m1to5",
      "m5to30",
      "m30to60",
      "h1to4",
      "over4h",
    ]);
  });
});
