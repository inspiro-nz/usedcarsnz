import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { handleChatTurn } from "@/lib/ai/trigger";
import { supabaseService } from "@/lib/supabase/service";
import { checkRateLimit, getClientIP } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/chat — the buyer thread page's SSE endpoint (strategy §7 Lane 1).
 *
 * The reply is generated, structured-parsed, and guard-validated FULLY on the
 * server before any of it is written to the stream: an un-vetted token
 * stream could leak non-compliant text mid-flight, and the guard can only
 * judge complete text. What streams to the browser is the already-safe
 * reply, chunked for a typing effect — the streaming requirement here is a
 * UI affordance, not a trust boundary (unlike the raw provider.stream() used
 * for the live smoke test, which never reaches a buyer directly).
 */

const bodySchema = z.object({
  enquiryId: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
});

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const ip = await getClientIP();
  if (!checkRateLimit(ip, { scope: "ai-chat", windowMs: 60_000, max: 20 })) {
    return NextResponse.json({ error: "Too many messages — please slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid enquiryId and message are required." }, { status: 400 });
  }
  const { enquiryId, message } = parsed.data;

  // Capability-URL model, same posture as anonymous enquiry creation: knowing
  // the enquiry UUID is the credential. Just confirm it exists before doing
  // any AI work.
  const svc = supabaseService();
  const { data: enquiry } = await svc.from("enquiries").select("id").eq("id", enquiryId).maybeSingle();
  if (!enquiry) {
    return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      try {
        const turn = await handleChatTurn(enquiryId, message);
        const words = turn.replyText.split(/(\s+)/);
        for (const word of words) {
          write(sse("token", { text: word }));
          if (word.trim()) await new Promise((r) => setTimeout(r, 12));
        }
        write(
          sse("done", {
            needsDealer: turn.needsDealer,
            dealerQuestion: turn.dealerQuestion,
            complete: turn.done,
          }),
        );
      } catch (err) {
        console.error("[api/ai/chat] turn failed:", err);
        write(
          sse("done", {
            needsDealer: true,
            dealerQuestion: null,
            complete: false,
            fallback: true,
            text: "Sorry — something went wrong on our end. The team will come back to you shortly.",
          }),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
