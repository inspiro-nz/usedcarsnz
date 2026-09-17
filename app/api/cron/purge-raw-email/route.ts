import { NextResponse, type NextRequest } from "next/server";
import { verifyCronRequest } from "@/lib/cron/auth";
import { supabaseService } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const BUCKET = "inbound-email-raw";
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (§7 data-minimisation)
const PAGE = 1000;

/**
 * POST /api/cron/purge-raw-email — deletes raw inbound-email MIME older than the
 * 30-day retention window. Triggered by the standalone Cron Worker
 * workers/raw-email-purge (the app worker has no scheduled handler).
 *
 * Objects are stored at `{dealer_id}/{enquiry_id}.eml`. This walks each dealer
 * prefix and removes expired objects via the STORAGE API (not a raw
 * storage.objects row delete), so the underlying object is actually reclaimed on
 * the hosted projects — the switch the migration-18 comment asked Prompt 7 to
 * make. Returns a count for observability.
 */
export async function POST(req: NextRequest) {
  const auth = verifyCronRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const svc = supabaseService();
  const bucket = svc.storage.from(BUCKET);
  const cutoff = Date.now() - RETENTION_MS;

  try {
    const { data: folders, error: fErr } = await bucket.list("", { limit: PAGE });
    if (fErr) throw new Error(fErr.message);

    const expired: string[] = [];
    for (const entry of folders ?? []) {
      // Folders (dealer_id prefixes) have no id/created_at; files do. Skip files
      // that somehow sit at the root — real objects live one level down.
      if (entry.id) continue;
      const { data: files, error: lErr } = await bucket.list(entry.name, {
        limit: PAGE,
        sortBy: { column: "created_at", order: "asc" },
      });
      if (lErr) throw new Error(lErr.message);
      for (const f of files ?? []) {
        const created = f.created_at ? Date.parse(f.created_at) : NaN;
        if (Number.isFinite(created) && created < cutoff) {
          expired.push(`${entry.name}/${f.name}`);
        }
      }
    }

    let purged = 0;
    // Remove in batches to keep each storage call bounded.
    for (let i = 0; i < expired.length; i += PAGE) {
      const batch = expired.slice(i, i + PAGE);
      const { error: rErr } = await bucket.remove(batch);
      if (rErr) throw new Error(rErr.message);
      purged += batch.length;
    }

    return NextResponse.json({ ok: true, purged });
  } catch (err) {
    console.error("[cron/purge-raw-email] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "purge failed" },
      { status: 500 },
    );
  }
}
