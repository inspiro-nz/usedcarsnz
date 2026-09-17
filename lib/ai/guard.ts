/**
 * Output validator for Lane 1 (strategy §7 compliance envelope).
 *
 * Runs on EVERY Lane 1 reply_text before it is persisted or shown to a buyer
 * — including replies from a model that was jailbroken by prompt injection.
 * The guard is the actual enforcement point; the system prompt is only a
 * hint the model might ignore. A hit here always wins over what the model
 * produced: the buyer gets the safe deferral, never the raw text.
 *
 * Categories, each an NZ-flavoured pattern list (§7 "NEVER auto-send"):
 *  - vehicle condition / history / spec / "as described" claims
 *  - CGA / warranty statements in either direction
 *  - finance/insurance recommendation, comparison, opinion, suitability
 *  - unapproved business claims (dealer premises/presence/logistics stated
 *    as fact, beyond dealers.approved_facts) — added after a live test
 *    (2026-09-12) caught a model inventing "we have a dealership right here
 *    in town" for a buyer's stated location, a fabricated claim none of the
 *    other three categories would have caught.
 */

export interface GuardResult {
  blocked: boolean;
  category?: "vehicle_condition" | "warranty_cga" | "finance_opinion" | "unapproved_business_claim";
  matched?: string;
  safeText: string;
}

const SAFE_DEFERRAL =
  "That's a great question — it's not something I can confirm myself, so I've flagged it for the team to answer you directly.";

interface Pattern {
  category: GuardResult["category"];
  re: RegExp;
}

// Deliberately over-inclusive: a false positive costs a deferred answer, a
// false negative costs a compliance breach. Patterns are case-insensitive and
// tolerant of common NZ vehicle-trade phrasing.
const PATTERNS: Pattern[] = [
  // --- vehicle condition / history / spec / "as described" ---
  { category: "vehicle_condition", re: /\bno\s+accidents?\b/i },
  { category: "vehicle_condition", re: /\baccident[\s-]?free\b/i },
  { category: "vehicle_condition", re: /\bmint\s+condition\b/i },
  { category: "vehicle_condition", re: /\bmechanically\s+sound\b/i },
  { category: "vehicle_condition", re: /\b(new|good|fresh)\s+tyres?\b/i },
  { category: "vehicle_condition", re: /\bwof\b/i },
  { category: "vehicle_condition", re: /\brego(?:\s+expir\w*)?\b/i },
  { category: "vehicle_condition", re: /\bregistration\s+expir\w*\b/i },
  { category: "vehicle_condition", re: /\bas\s+described\b/i },
  { category: "vehicle_condition", re: /\bodomet(er|re)\s+(is|reads?|shows?)\b/i },
  { category: "vehicle_condition", re: /\bno\s+known\s+issues?\b/i },
  { category: "vehicle_condition", re: /\bruns?\s+(great|perfectly|well)\b/i },
  { category: "vehicle_condition", re: /\b(engine|gearbox|transmission|clutch)\s+(is|has\s+been)\s+(fine|good|healthy|perfect|reliable)\b/i },
  { category: "vehicle_condition", re: /\bfull\s+service\s+history\b/i },
  { category: "vehicle_condition", re: /\bone\s+owner\b/i },
  { category: "vehicle_condition", re: /\bnever\s+(?:been\s+in|had)\s+(?:an|any)\s+accidents?\b/i },

  // --- CGA / warranty, either direction ---
  { category: "warranty_cga", re: /\bno\s+warranty\b/i },
  { category: "warranty_cga", re: /\bwarrant(y|ies)\b/i },
  { category: "warranty_cga", re: /\bconsumer\s+guarantees?\s+act\b/i },
  { category: "warranty_cga", re: /\bcga\b/i },
  { category: "warranty_cga", re: /\byour\s+rights\s+(are|include)\b/i },
  { category: "warranty_cga", re: /\bcovered\s+(by|under)\b/i },
  { category: "warranty_cga", re: /\bguarantee[ds]?\s+(against|for)\b/i },

  // --- finance / insurance recommendation, comparison, opinion, suitability ---
  { category: "finance_opinion", re: /\byou'?ll\s+qualify\b/i },
  { category: "finance_opinion", re: /\bbest\s+(loan|finance|lender|rate|deal)\b/i },
  { category: "finance_opinion", re: /\b(recommend|suggest)\s+(you\s+)?(get|take|use|go\s+with)\b.*\b(loan|finance|lender|insurance)\b/i },
  { category: "finance_opinion", re: /\byou\s+should\s+(get|take|use|choose|go\s+with)\b.*\b(loan|finance|lender|insurance)\b/i },
  { category: "finance_opinion", re: /\b(cheaper|better|lower[\s-]interest)\s+than\b/i },
  { category: "finance_opinion", re: /\byou\s+(can|will)\s+afford\b/i },
  { category: "finance_opinion", re: /\bapproval\s+is\s+likely\b/i },
  { category: "finance_opinion", re: /\binterest\s+rate\s+of\s+\d/i },
  { category: "finance_opinion", re: /\bsuitable\s+for\s+you\b/i },

  // --- unapproved business claims: proximity/convenience to THIS buyer ---
  // Deliberately narrow — approved_facts.address already covers a plain
  // factual disclosure ("we're located at 123 Main St"), which must keep
  // working, so this does NOT block location statements generally. It
  // blocks the specific thing a model fabricates when a buyer mentions
  // their own location: an unverifiable claim that the dealer is
  // conveniently close to THAT buyer — nothing in approved_facts or the
  // conversation lets the model know that, so it's always invented
  // (confirmed live, 2026-09-12: "we have a dealership right here in town").
  { category: "unapproved_business_claim", re: /\bright\s+here\s+in\s+town\b/i },
  { category: "unapproved_business_claim", re: /\b(?:near|close\s+to)\s+you\b/i },
  { category: "unapproved_business_claim", re: /\bconvenient\s+for\s+(?:us|you)\b/i },
];

/**
 * Screens a Lane 1 reply. On a hit, returns the safe deferral in place of the
 * model's text — callers must use `safeText`, never the original, and must
 * set needs_dealer=true and log guard_blocked when `blocked` is true.
 */
export function guardReply(replyText: string): GuardResult {
  for (const { category, re } of PATTERNS) {
    const match = replyText.match(re);
    if (match) {
      return { blocked: true, category, matched: match[0], safeText: SAFE_DEFERRAL };
    }
  }
  return { blocked: false, safeText: replyText };
}
