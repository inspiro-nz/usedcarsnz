import Link from "next/link";
import { HeaderAuthNav } from "./header-auth-nav";
import { NavLink } from "./nav-link";

/**
 * Marketplace chrome. The homepage keeps its own Navbar/Footer untouched —
 * these mirror that design (white/95 blur header, slate-950 footer, orange
 * CTA) but link to real marketplace routes instead of homepage hash anchors.
 *
 * The header is a STATIC shell: logo, Browse cars, and — via HeaderAuthNav —
 * the logged-out CTAs by default, upgraded client-side once GET /api/viewer
 * answers. It must never read cookies/headers itself: this layout wraps the
 * ISR routes (listing detail, dealer storefront), and any request-state read
 * here forces them dynamic under a production build (a 500, not a fallback).
 */

export function MarketplaceHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link href="/" className="shrink-0 text-xl font-bold text-slate-900">
            UsedCars<span className="text-orange-500">NZ</span>
          </Link>

          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-2">
            <NavLink href="/cars">Browse cars</NavLink>
            <HeaderAuthNav />
          </nav>
        </div>
      </div>
    </header>
  );
}

export function MarketplaceFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-slate-950 px-4 py-14 text-slate-400 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start justify-between gap-10 sm:flex-row">
          <div className="max-w-xs">
            <Link
              href="/"
              className="mb-3 inline-block text-xl font-bold text-white"
            >
              UsedCars<span className="text-orange-500">NZ</span>
            </Link>
            <p className="text-sm leading-relaxed">
              An Inspiral NZ venture. Co-list alongside Trade Me — every enquiry
              answered in under a minute, with the numbers published.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Marketplace
            </p>
            <nav className="flex flex-col gap-2.5">
              <Link href="/cars" className="text-sm transition-colors hover:text-white">
                Browse cars
              </Link>
              <Link
                href="/register-dealer"
                className="text-sm transition-colors hover:text-white"
              >
                List with us
              </Link>
              <Link href="/sign-in" className="text-sm transition-colors hover:text-white">
                Sign in
              </Link>
            </nav>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Program
            </p>
            <Link
              href="/#join"
              className="text-sm font-medium text-orange-400 transition-colors hover:text-orange-300"
            >
              Join the Founding Dealer Program
            </Link>
            <p className="text-sm">New Zealand dealerships welcome</p>
          </div>
        </div>

        <p className="mt-10 max-w-3xl text-xs leading-relaxed text-slate-500">
          Dealer listings display the dealer&apos;s in-trade status and Consumer
          Information Notice. AI assistance is always labelled; anything about a
          specific vehicle comes from the seller, approved by a human.
        </p>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-slate-800 pt-6 text-xs sm:flex-row">
          <p>&copy; {year} UsedCarsNZ. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-white">
              Privacy
            </Link>
            <p>Built for New Zealand dealerships.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
