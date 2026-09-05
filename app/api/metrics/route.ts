import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import {
  dealerMetrics,
  allDealerMetrics,
  platformMetrics,
} from "@/lib/metrics-views";
import { applyPublishGate, dealerMetricsToCsv } from "@/lib/metrics-publish";

/**
 * GET /api/metrics — the §9.2 conversion metrics, read straight from the views.
 *
 *   - A dealer gets ONLY their own numbers (RLS scopes the views; there is no
 *     dealer_id parameter to spoof).
 *   - An admin gets the platform aggregate plus every dealer's headline row.
 *   - ?format=csv exports the caller's dealer row(s) as CSV (§9.2). A dealer
 *     exports their single row; an admin exports every dealer — RLS decides,
 *     the same query serves both.
 *
 * No client-side metric maths anywhere: every number here originates in the
 * immutable lead_events log and is computed by the SQL views. This handler only
 * authorises, reads, and serialises.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const isDealer = viewer.dealers.length > 0;
  if (!viewer.isAdmin && !isDealer) {
    return NextResponse.json(
      { error: "Metrics are available to dealers and admins only." },
      { status: 403 },
    );
  }

  const format = request.nextUrl.searchParams.get("format");

  if (format === "csv") {
    // RLS scopes the rows: a dealer exports their single row, an admin all rows.
    const rows = await allDealerMetrics();
    const csv = dealerMetricsToCsv(rows);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="usedcarsnz-metrics-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (viewer.isAdmin) {
    const [platform, dealers] = await Promise.all([
      platformMetrics(),
      allDealerMetrics(),
    ]);
    return NextResponse.json(
      { scope: "admin", platform: applyPublishGate(platform), dealers },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const metrics = await dealerMetrics(viewer.dealers[0].id);
  return NextResponse.json(
    { scope: "dealer", metrics },
    { headers: { "Cache-Control": "no-store" } },
  );
}
