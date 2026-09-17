import type { MetadataRoute } from "next";

/**
 * Crawler policy (strategy §demand: programmatic SEO + answer-engine optimisation).
 *
 * Two things here are load-bearing and easy to get wrong:
 *
 * 1. robots.txt paths are PREFIX matches, so a bare `/dealer` also blocks the
 *    public dealer storefronts at `/dealers/[id]` — the exact pages we most want
 *    indexed. `/dealer$` pins the private dashboard index and `/dealer/` covers
 *    its children, leaving `/dealers/...` crawlable.
 *
 * 2. A crawler obeys only its MOST SPECIFIC matching user-agent group and ignores
 *    the wildcard group entirely. The named AI crawlers therefore have to repeat
 *    the disallow list — without it, naming them would hand them /dealer and
 *    /admin, which the wildcard group denies.
 *
 * The private routes are auth-gated and RLS-scoped regardless; the disallows keep
 * them out of indexes rather than serving as an access control.
 */

// Answer engines we explicitly welcome. Grounding our listing/dealer pages in
// these is the whole demand-side thesis, so the allow is deliberate, not inherited
// from the wildcard.
const AI_CRAWLERS = [
  "GPTBot", // OpenAI — training/grounding crawler
  "OAI-SearchBot", // OpenAI — powers ChatGPT search results
  "ChatGPT-User", // OpenAI — user-initiated page fetches
  "ClaudeBot", // Anthropic
  "anthropic-ai", // Anthropic (legacy token, still honoured)
  "PerplexityBot", // Perplexity
  "Google-Extended", // Gates Gemini/Vertex use of already-crawled content
  "CCBot", // Common Crawl — feeds many downstream models
];

const DISALLOW = ["/dealer$", "/dealer/", "/admin$", "/admin/", "/account", "/thread/"];

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://usedcarsnz.co.nz";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${site}/sitemap.xml`,
  };
}
