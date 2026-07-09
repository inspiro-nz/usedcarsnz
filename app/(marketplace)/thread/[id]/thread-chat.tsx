"use client";

import { useRef, useState } from "react";
import type { MessageSender } from "@/lib/db/types";

interface ChatMessage {
  id: string;
  sender: MessageSender;
  body: string;
  createdAt: string;
}

/**
 * Streaming chat UI for the buyer thread (strategy §7 Lane 1). The
 * "AI assistant of {dealer}" label stays visible at all times per spec —
 * this is a buyer talking to software, and that must never be ambiguous.
 * On any failure (network, provider, guard fallback) the thread degrades to
 * "the team will come back to you" rather than looking broken — no error
 * stack, no dead input, always a next step for the buyer.
 */
export function ThreadChat({
  enquiryId,
  dealerName,
  initialMessages,
}: {
  enquiryId: string;
  dealerName: string | null;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const streamingId = useRef<string | null>(null);
  const localIdCounter = useRef(0);

  const seller = dealerName ?? "the seller";

  function nextLocalId(prefix: string): string {
    localIdCounter.current += 1;
    return `${prefix}-${localIdCounter.current}`;
  }

  async function send() {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft("");
    setPending(true);

    const nowIso = new Date().toISOString();
    const buyerMsg: ChatMessage = {
      id: nextLocalId("local"),
      sender: "buyer",
      body: text,
      createdAt: nowIso,
    };
    const aiId = nextLocalId("streaming");
    streamingId.current = aiId;
    setMessages((prev) => [...prev, buyerMsg, { id: aiId, sender: "ai", body: "", createdAt: nowIso }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enquiryId, message: text }),
      });
      if (!res.ok || !res.body) throw new Error(`chat request failed: ${res.status}`);
      await readSse(res.body, {
        onToken: (chunk) => appendToStreaming(aiId, chunk),
        onDone: (payload) => {
          if (payload.fallback && typeof payload.text === "string") {
            setMessageBody(aiId, payload.text);
            setDegraded(true);
          }
        },
      });
    } catch {
      setMessageBody(
        aiId,
        "Sorry — something went wrong on our end. The team will come back to you shortly.",
      );
      setDegraded(true);
    } finally {
      streamingId.current = null;
      setPending(false);
    }
  }

  function appendToStreaming(id: string, chunk: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body: m.body + chunk } : m)));
  }
  function setMessageBody(id: string, body: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body } : m)));
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
        <span className="inline-flex h-2 w-2 rounded-full bg-orange-500" aria-hidden />
        <p className="text-xs font-medium text-slate-500">
          You&apos;re chatting with the <span className="font-semibold text-slate-700">AI assistant of {seller}</span>
        </p>
      </div>

      <div className="flex max-h-[60vh] min-h-[240px] flex-col gap-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-400">Say hello to get started.</p>
        ) : (
          messages.map((m) => <Bubble key={m.id} message={m} seller={seller} />)
        )}
      </div>

      {degraded ? (
        <div className="mx-5 mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
          The assistant is having trouble right now — the team will come back to you personally.
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex items-center gap-2 border-t border-slate-100 px-4 py-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          disabled={pending}
          maxLength={2000}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-400 transition disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim()}
          className="shrink-0 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
        >
          {pending ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}

function Bubble({ message, seller }: { message: ChatMessage; seller: string }) {
  if (message.sender === "system") {
    return <p className="text-center text-xs text-slate-400">{message.body}</p>;
  }
  const isBuyer = message.sender === "buyer";
  const label = isBuyer ? "You" : message.sender === "dealer" ? seller : `AI assistant of ${seller}`;
  return (
    <div className={`flex flex-col ${isBuyer ? "items-end" : "items-start"}`}>
      <span className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <div
        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isBuyer ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-900"
        }`}
      >
        {message.body || "…"}
      </div>
    </div>
  );
}

interface DonePayload {
  needsDealer?: boolean;
  dealerQuestion?: string | null;
  complete?: boolean;
  fallback?: boolean;
  text?: string;
}

/** Manual SSE parser — EventSource can't POST, so the fetch body reader is parsed by hand. */
async function readSse(
  body: ReadableStream<Uint8Array>,
  handlers: { onToken: (text: string) => void; onDone: (payload: DonePayload) => void },
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split("\n\n");
    buf = events.pop() ?? "";
    for (const raw of events) {
      const eventLine = raw.split("\n").find((l) => l.startsWith("event:"));
      const dataLine = raw.split("\n").find((l) => l.startsWith("data:"));
      if (!eventLine || !dataLine) continue;
      const event = eventLine.replace("event:", "").trim();
      const data = JSON.parse(dataLine.replace("data:", "").trim());
      if (event === "token") handlers.onToken(data.text as string);
      else if (event === "done") handlers.onDone(data as DonePayload);
    }
  }
}
