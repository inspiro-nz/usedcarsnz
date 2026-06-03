# UsedCarsNZ — Product Requirements Document

**Version:** 5.1  
**Date:** June 2026  
**Stage:** Pre-product — Founding Dealer Acquisition

---

## 1. What UsedCarsNZ Is

UsedCarsNZ is a **response-speed platform** for New Zealand car dealerships.

It helps dealers respond faster to buyer enquiries, capturing sales opportunities before the buyer contacts a competitor or goes cold.

### What it is NOT

| Not this | Why it matters |
|---|---|
| A marketplace | We don't list cars or host buyer search |
| A listing site | We don't compete with Trade Me |
| A dealer website builder | We don't replace dealer websites |
| A CRM | We don't replace Motorcentral, AutoPlay, or similar |

The core positioning: **UsedCarsNZ sits on top of the enquiry flow dealers already have, and makes it faster.**

---

## 2. The Problem

Buyers today submit enquiries to multiple dealerships simultaneously. The dealer who responds first wins the conversation. Dealers who respond hours later — or the next business day — are rarely given a second chance.

### Validated pain points (from dealer discovery)

1. **Missed enquiries** — Buyers move on before a dealer calls back
2. **Delayed responses** — Showroom traffic, admin work, and after-hours gaps mean enquiries are seen too late
3. **Multi-dealer shopping** — Buyers contact 3–5 dealers at once; speed determines who gets the appointment
4. **Lost sales** — Every delayed response is a direct revenue loss to a faster competitor

### Hypothesis (to be proven with Founding Dealers)

Reducing average response time from hours to minutes will meaningfully increase appointment bookings from existing enquiry volume — without any additional advertising spend.

---

## 3. Target Customer

**Primary:** New Zealand used car dealerships

- Independent dealers, 10–200 vehicles in stock
- 20–200+ online enquiries per month
- Currently listing on Trade Me Motors (primary), plus website and/or Facebook
- Using Motorcentral or AutoPlay for DMS (common in NZ market)
- Frustrated with Trade Me cost increases and/or lead quality

**Founding Dealer Profile (ideal):**

- NZ-wide (program is now open nationally, not Christchurch-only)
- 50–200 monthly enquiries
- Acknowledges slow follow-up is a real problem
- Willing to trial a new product and provide feedback
- Opportunity score 40–50 on the dealer scoring framework

---

## 4. Founding Dealer Program

The Founding Dealer Program is the current go-to-market strategy. It replaced the original "Christchurch Pilot" framing and is now open to all NZ dealerships.

**Program details:**

- Limited to the first 10 dealerships
- Zero cost during the program
- Free onboarding and setup (under 1 hour, no DMS migration required)
- Direct founder access for feedback
- Founding members shape the feature roadmap
- Discounted pricing when the product moves to paid

**Why "Founding Dealer" over "Pilot":**

Pilot framing suggests experimental and temporary. Founding Dealer signals a permanent relationship and elevated status — more appropriate for recruiting early adopters who will become long-term customers.

---

## 5. Landing Page — Current State

The landing page is **live and in production** on Cloudflare Pages.

### Sections implemented

| Section | Status | Notes |
|---|---|---|
| Navigation | ✅ Live | Fixed, responsive, mobile hamburger menu |
| Hero | ✅ Live | "Founding Dealer Program — Limited Availability" |
| Problem | ✅ Live | 4 pain points with icons |
| How It Works | ✅ Live | 4-step process with numbered circles |
| Why Dealers Join | ✅ Live | 6 benefits in 3-column grid |
| Join Form | ✅ Live | Secure form with Cloudflare Turnstile |
| FAQ | ✅ Live | 6 questions, accordion |
| Footer | ✅ Live | Navigation, CTA, copyright |

### Form and lead capture

| Feature | Status |
|---|---|
| Fields: name, dealership, email, phone, monthly enquiries | ✅ |
| Cloudflare Turnstile CAPTCHA | ✅ |
| Honeypot bot trap | ✅ |
| Zod server-side validation | ✅ |
| HTML sanitisation before email insertion | ✅ |
| Rate limiting (5 per IP per hour) | ✅ in-memory — see Known Limitations |
| Email via Resend to founder inbox | ✅ |
| Success state with confirmation | ✅ |
| Error handling with user-visible messages | ✅ |

### Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Deployment | Cloudflare Pages via @opennextjs/cloudflare |
| Email | Resend |
| CAPTCHA | Cloudflare Turnstile |
| Validation | Zod |

---

## 6. Known Limitations

| Item | Impact | Resolution |
|---|---|---|
| In-memory rate limiting | Resets on Cloudflare Worker cold start — no distributed protection in production | Upgrade to Cloudflare KV (guide in docs/form-security.md) |
| No persistence layer | Lead submissions go to email only — no dashboard, no CSV export | Acceptable now; upgrade path is KV or D1 |
| No analytics | No visibility into page views, scroll depth, or form abandonment | Add Cloudflare Web Analytics (free, privacy-first) |

---

## 7. What Is NOT in Scope (Current Phase)

The following are deliberately excluded:

- The actual notification/alerting product (not yet built)
- Dealer-facing dashboard
- Integration with Trade Me or any enquiry source platform
- CRM integration (Motorcentral, AutoPlay)
- Buyer-facing features
- Paid subscription infrastructure
- Multi-user accounts

---

## 8. Next Milestones

### Phase 0 — Validation (current)
- [ ] Recruit 10 Founding Dealers via landing page and direct outreach
- [ ] Complete dealer discovery interviews using `docs/dealer-validation-kit.md`
- [ ] Record interview results in `docs/dealer-interviews.md`
- [ ] Validate: 3/5 dealers confirm slow response loses sales
- [ ] Validate: 3/5 dealers agree to trial a prototype

### Phase 1 — MVP Product
- [ ] Define what "faster response" means as a delivered feature (SMS alert, auto-reply, or AI-drafted response)
- [ ] Build prototype for Founding Dealers to use with real enquiries
- [ ] Measure before/after response times for pilot dealers
- [ ] Define pricing model based on discovery findings

### Phase 2 — Paid Product
- [ ] First paid subscription
- [ ] Self-serve onboarding
- [ ] Upgrade rate limiting to Cloudflare KV
- [ ] Add analytics to landing page

---

## 9. Requirements vs. Original Brief

| Requirement | Status |
|---|---|
| Mobile-first responsive design | ✅ |
| Hero with problem-led headline and subheadline | ⚠️ Evolved — headline updated to benefit-led framing |
| Problem section (missed enquiries, delayed responses, multi-dealer, lost sales) | ✅ |
| How It Works (4 steps) | ✅ |
| Why Dealers Join (4 benefits) | ✅ Expanded to 6 |
| Pilot form with specified fields | ✅ |
| FAQ accordion | ✅ |
| Footer | ✅ |
| Primary CTA: "Join the Christchurch Pilot" | ⚠️ Evolved — "Join the Founding Dealer Program", nationwide |
| No backend | ⚠️ Overridden — `/api/lead` added for secure form submission. Correct call: a mailto link is not viable for production lead capture. |
| SEO metadata | ✅ |
| Reusable components | ✅ |
| Production-ready design | ✅ |

### Key evolutions from original brief

**1. Christchurch Pilot → Founding Dealer Program, nationwide NZ**
Geographic restriction removed. "Founding Dealer" creates stronger early-adopter psychology and removes artificial geographic friction.

**2. "No backend" requirement overridden**
A form without server-side validation, CAPTCHA, and rate limiting is not viable for production. The API route is the right call.

**3. Headline evolved**
Original: "Stop Losing Vehicle Enquiries to Slow Response Times" (problem-led).
Current: "Help every enquiry get a professional response, even after hours" (benefit-led). Both are valid; current version tests a softer, more aspirational angle.

---

## 10. Open Questions

1. What does the MVP product actually do — real-time SMS alert, auto-reply, or AI-drafted response?
2. Should the original problem-led headline be A/B tested against the current benefit-led version?
3. At what volume of leads does Cloudflare KV rate limiting become necessary?
4. Should Christchurch remain a priority geography for direct outreach even though the program is nationwide?
5. What is the pricing model — flat monthly fee, per enquiry, or performance-based?
