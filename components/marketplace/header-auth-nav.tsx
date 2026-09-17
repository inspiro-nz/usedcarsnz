"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOutAction } from "@/app/(marketplace)/(auth)/actions";
import { SIGNED_OUT, type ViewerSummary } from "@/lib/viewer-summary";
import { NavLink } from "./nav-link";

/**
 * The header's auth sliver. Renders the logged-out CTAs by default (so the
 * server-rendered, ISR-cacheable shell is identical for every visitor), then
 * asks GET /api/viewer who is looking and upgrades the nav once it knows.
 *
 * Why a client fetch and not a server read: the (marketplace) layout renders
 * this header on every marketplace page, and a cookie read anywhere in that
 * render forces the ISR routes (listing detail, dealer storefront) dynamic
 * under a production build — they 500. A <Suspense> boundary was tried and
 * does NOT help without Partial Prerendering (verified under `next start`).
 *
 * Re-fetched on every pathname change, not just on mount: the layout — and
 * therefore this component — persists across client-side navigations, and
 * sign-in is a soft router.push, so a mount-only read would leave a freshly
 * signed-in dealer looking at "Sign in" until a hard reload.
 *
 * data-auth-state lets tests wait for the upgrade rather than race it.
 */
export function HeaderAuthNav() {
  const pathname = usePathname();
  const [viewer, setViewer] = useState<ViewerSummary | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/viewer", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<ViewerSummary>) : SIGNED_OUT))
      .then((v) => setViewer(v))
      .catch(() => {
        if (!controller.signal.aborted) setViewer(SIGNED_OUT);
      });
    return () => controller.abort();
  }, [pathname]);

  const known = viewer ?? SIGNED_OUT;
  const state =
    viewer === null ? "unknown" : known.signedIn ? "signed-in" : "signed-out";

  return (
    <span className="contents" data-auth-state={state}>
      {known.isDealer ? <NavLink href="/dealer">Dashboard</NavLink> : null}
      {known.isAdmin ? <NavLink href="/admin">Admin</NavLink> : null}
      {!known.signedIn ? (
        <>
          <NavLink href="/sign-in">Sign in</NavLink>
          <Link
            href="/register-dealer"
            className="inline-flex shrink-0 items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
          >
            List with us
          </Link>
        </>
      ) : (
        <>
          {!known.isDealer ? (
            <NavLink href="/register-dealer">List with us</NavLink>
          ) : null}
          <NavLink href="/account">My account</NavLink>
          <form action={signOutAction} className="inline shrink-0">
            <button className="whitespace-nowrap px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:px-3">
              Sign out
            </button>
          </form>
        </>
      )}
    </span>
  );
}
