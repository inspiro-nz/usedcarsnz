# Testing the AI layer

How the bounded AI layer (strategy §7) is tested: a fully offline default suite
built on a deterministic **mock** adapter, plus an opt-in **live** lane for local
semantic smoke. See [testing.md](testing.md) for the wider unit/E2E split.

## The mock / live split

| Lane | Adapter | Network? | Runs by default? | Purpose |
| --- | --- | --- | --- | --- |
| Default | mock (`fake-provider.ts`) | none | ✅ every `npm test` / CI | compliance + pipeline correctness, deterministic |
| Live-optional | `ollama-provider.ts` | localhost only | ❌ only with `AI_LIVE_OLLAMA=1` | semantic "does this roughly work" smoke |

The two **live** production adapters (`workers-ai`, `anthropic`, in
`lib/ai/provider.ts`) are **never** exercised by the test suite — tests inject a
provider directly, so no Neurons are spent and no API key is needed.

### Neither new adapter is in the production provider selection

This is a hard constraint (not an accident of wiring):

- The production registry is `AI_PROVIDERS` in `lib/env.ts` (`"workers-ai" |
  "anthropic"`), resolved per-lane by `getProvider()` in `lib/ai/provider.ts`.
- **Neither** the mock **nor** the Ollama adapter is added to that enum or to
  `getProvider()`. They conform to the `AiProvider` interface *only* so a test
  can pass one straight into the code under test (`generateStructured`, the
  qualify/draft pipelines). They live under `lib/ai/__tests__/` and are
  unreachable from any deployed request path.

## Default suite — offline & deterministic

```
npm test                          # vitest run — mock adapter only, zero network
npx vitest run --no-file-parallelism   # same, under the deterministic pool
```

No network access, no API keys, no Neurons. Tests replace `getProvider` with a
`vi.fn()` and feed it `makeFakeProvider(name, respond)`, where `respond` is
caller-supplied raw text — including deliberately **non-compliant** and
**hostile** output that no real model can be relied on to produce on cue.

`lib/ai/__tests__/fake-provider.ts` exports helpers for this:

- `qualifyResponse(partial)` / `draftResponse(text)` — build well-formed
  structured JSON without hand-writing it.
- `NONCOMPLIANT_QUALIFY_OUTPUTS` — canned §7-violating qualify replies
  (`warranty`, `invented_condition`, `finance_opinion`, `injection_compliance`),
  each with `needs_dealer:false` so the model *claims* its reply is safe to
  auto-send. Feeding these to `guardReply` proves the **guard** — not the model's
  self-report — is the enforcement point.

### Why compliance is proven by feeding bad output on purpose

The compliance guarantee (§7) is that a non-compliant reply — warranty claim,
invented vehicle condition, finance opinion, or a reply that obeyed a prompt
injection — is caught by `lib/ai/guard.ts` and swapped for the safe deferral,
with `needs_dealer=true` and a `guard_blocked` event. That guard must hold
against the **weakest realistic model output**. The only reliable way to test it
is to hand it bad output deliberately (the mock), never to hope a model
misbehaves on cue.

Injection-as-data is asserted at two seams, deliberately:

- `lib/inbound/injection.test.ts` — end-to-end through the real Worker extractor
  and the real `triggerQualification` + DB path.
- `lib/ai/__tests__/injection-guard-boundary.test.ts` — the same property at the
  narrower **adapter/guard boundary**, in isolation. It **imports** the existing
  `workers/email-inbound/fixtures/hostile-injection.eml` (parsed via the real
  extractor, never copied) so there's no fixture drift.

## Live-optional Ollama lane — local semantic smoke ONLY

```
# One-time: install Ollama and pull a model, e.g.
ollama pull llama3.1

# Run just the live smoke against your local server:
AI_LIVE_OLLAMA=1 npx vitest run lib/ai/__tests__/ollama.live.test.ts
```

Config, read **only** by the smoke spec / its adapter (never by `lib/env.ts` or
any request-path code):

| Env var | Default | Meaning |
| --- | --- | --- |
| `AI_LIVE_OLLAMA` | *(unset)* | must be `1` to run; otherwise the spec **skips** |
| `AI_OLLAMA_BASE_URL` | `http://localhost:11434` | local Ollama endpoint |
| `AI_OLLAMA_MODEL` | `llama3.1` | model tag to smoke |

With `AI_LIVE_OLLAMA` unset the spec skips cleanly (just like the Playwright
sign-in spec skips without a test user) — it never runs in `npm test` or CI, so
the default run stays offline.

### ⚠ Ollama is NEVER a compliance assertion

Ollama is for **semantic** "does the pipeline roughly work against a real local
model" smoke only. It must never be the basis of a compliance claim: if your
local model follows instructions *better* than the deployed Workers AI open
model, a green Ollama run gives **false** compliance confidence. Compliance is
proven by the mock feeding the guard bad output (above), full stop. The adapter
and the spec both carry this caveat in their headers.
