import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Post-sign-in router. Signing in used to land everyone on `/` — the founding
 * dealer *marketing* page — so a dealer who just logged in to work their leads
 * was shown their own sales pitch. This route computes the right home AFTER the
 * session is established and forwards there; it renders nothing, so the
 * marketing page never flashes.
 *
 *   admin  → /admin
 *   dealer → /dealer  (membership = owned dealership; see getViewer)
 *   buyer  → /account
 *   no session → /sign-in
 *
 * A safe in-app `?next=` return-to wins over the role default (deep-link case):
 * a future auth gate can bounce through `/sign-in?next=/somewhere` and the
 * user still ends up where they were headed. Only relative in-app paths are
 * honoured — never an absolute or protocol-relative URL (open-redirect guard).
 */
export default async function HomeRouter({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (next && isSafeReturnTo(next)) redirect(next);

  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (viewer.isAdmin) redirect("/admin");
  if (viewer.dealers[0]) redirect("/dealer");
  redirect("/account");
}

/** In-app absolute path only: "/foo" yes; "//evil.com" and "https://…" no. */
function isSafeReturnTo(next: string): boolean {
  return next.startsWith("/") && !next.startsWith("//");
}
