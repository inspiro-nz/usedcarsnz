import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseService } from "@/lib/supabase/service";
import { checkRateLimit, getClientIP } from "@/lib/security";
import type { MessageRow } from "@/lib/db/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/thread/[id]/messages?after=<ISO timestamp> — lets the buyer
 * thread page (ThreadChat) poll for messages that landed after the buyer's
 * own turn completed, e.g. a dealer reply sent from the portal while this
 * tab was open. Same capability-URL posture as the thread page itself and
 * POST /api/ai/chat: the enquiry UUID is the credential, no membership check
 * beyond "does it exist".
 */

const querySchema = z.object({ after: z.string().datetime() });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = await getClientIP();
  if (!checkRateLimit(ip, { scope: "thread-poll", windowMs: 60_000, max: 60 })) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { id } = await params;
  const parsed = querySchema.safeParse({ after: request.nextUrl.searchParams.get("after") });
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid 'after' timestamp is required." }, { status: 400 });
  }

  const svc = supabaseService();
  const { data: enquiry } = await svc.from("enquiries").select("id").eq("id", id).maybeSingle();
  if (!enquiry) {
    return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  }

  const { data: messages } = await svc
    .from("messages")
    .select("*")
    .eq("enquiry_id", id)
    .gt("created_at", parsed.data.after)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    messages: ((messages ?? []) as MessageRow[]).map((m) => ({
      id: m.id,
      sender: m.sender,
      body: m.body,
      createdAt: m.created_at,
    })),
  });
}
