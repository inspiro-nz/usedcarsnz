# Email fixtures

`.eml` samples driving the extractor + handler tests (`../test/`).

> **⚠ SYNTHETIC.** We do **not** have confirmed real Trade Me lead emails yet.
> `trademe-synthetic.eml` and `hostile-injection.eml` are a **best-effort
> reconstruction** of the Trade Me Motors enquiry format. Real emails will drift
> from this shape — the extractor is written defensively to degrade to the
> generic path rather than throw (see `../src/extractors/trademe.ts`).
>
> **TODO(fixtures):** once the pilot produces a real (redacted) Trade Me lead
> email, drop it in as `trademe-real-redacted.eml`, add a test asserting the
> extractor still pulls buyer/name/phone/listing from it, and tighten the label
> patterns in `trademe.ts` to match the real structure.

| File | Purpose |
|---|---|
| `trademe-synthetic.eml` | Happy-path Trade Me lead: labelled From/Email/Phone/Listing/Message. |
| `generic.eml` | A buyer emailing a `lead-*` alias directly — generic extractor path. |
| `malformed.eml` | No sender, empty subject, junk body — must NOT throw; low confidence, null email. |
| `hostile-injection.eml` | Trade Me lead whose message body is a prompt-injection payload — must be treated as DATA (§7). |
| `forwarding-confirmation.eml` | Gmail forwarding-setup confirmation — must be forwarded to the founder, never parsed as a lead. |
