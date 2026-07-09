"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ErrorNote, Field, inputCls } from "@/components/marketplace/ui";

type Status = "idle" | "sending" | "sent" | "error";

export function EnquiryFormClient({ listingId, siteKey }: { listingId: string; siteKey: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(!siteKey);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const tokenRef = useRef<string>("");

  // Invisible Turnstile widget — no layout shift, executes automatically on
  // mount so a token is usually ready before the buyer finishes typing.
  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (!window.turnstile || !containerRef.current) {
        setError("Security verification failed. Please refresh and try again.");
        return;
      }
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          size: "invisible",
          callback: (token: string) => {
            tokenRef.current = token;
            setTurnstileReady(true);
          },
          "expired-callback": () => {
            tokenRef.current = "";
            setTurnstileReady(false);
          },
          "error-callback": () => {
            setError("Security verification failed. Please refresh and try again.");
            setTurnstileReady(false);
          },
        });
      } catch {
        setError("Security verification failed. Please refresh and try again.");
      }
    };

    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
      if (window.turnstile && widgetIdRef.current) window.turnstile.remove(widgetIdRef.current);
    };
  }, [siteKey]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const token = tokenRef.current || window.turnstile?.getResponse(widgetIdRef.current);
    if (siteKey && !token) {
      setError("Please wait a moment for security verification to finish, then try again.");
      return;
    }

    setStatus("sending");
    const form = new FormData(e.currentTarget);
    const payload = {
      listing_id: listingId,
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      message: String(form.get("message") ?? "").trim(),
      website: String(form.get("website") ?? "").trim(),
      token: token ?? "",
    };

    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Unable to send your enquiry. Please try again.");
        setStatus("error");
        if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
        return;
      }
      setStatus("sent");
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
      if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
    }
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-600">
          Sent — expect a reply within a minute
        </p>
        <h3 className="mt-2 font-semibold text-slate-900">
          Enquiry sent — and already acknowledged.
        </h3>
        <p className="mt-2 text-sm text-slate-700">
          Our AI assistant has confirmed your enquiry by email and passed it to
          the seller as a qualified lead. A human will reply about the vehicle
          itself.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-live="polite"
      className="space-y-4 rounded-2xl border border-slate-100 bg-white shadow-sm p-5"
    >
      {/* Honeypot — hidden from real users, catches autofill bots */}
      <input
        type="text"
        name="website"
        style={{ display: "none" }}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <div>
        <h3 className="font-semibold text-slate-900">Enquire about this car</h3>
        <p className="mt-1 text-xs text-slate-500">
          No account needed. First response in under 60 seconds — it&apos;s
          what we measure ourselves on.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input name="name" required className={inputCls} autoComplete="name" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required className={inputCls} autoComplete="email" />
        </Field>
      </div>
      <Field label="Phone (optional)">
        <input name="phone" className={inputCls} autoComplete="tel" />
      </Field>
      <Field label="Message (optional)">
        <textarea
          name="message"
          rows={3}
          className={inputCls}
          placeholder="Ask anything — is it available, can I view it…"
        />
      </Field>

      <div ref={containerRef} />

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <button
        disabled={status === "sending" || (!!siteKey && !turnstileReady)}
        className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : "Send enquiry"}
      </button>
      <p className="text-xs text-slate-500">
        You&apos;ll get an instant automated acknowledgement from our clearly
        labelled AI assistant. Anything about this specific vehicle comes from
        the seller, approved by a human.
      </p>
    </form>
  );
}
