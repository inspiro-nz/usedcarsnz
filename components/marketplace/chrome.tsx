import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { signOutAction } from "@/app/(marketplace)/(auth)/actions";

/**
 * Marketplace chrome. The homepage keeps its own Navbar/Footer untouched —
 * these mirror that design (white/95 blur header, slate-950 footer, orange
 * CTA) but link to real marketplace routes instead of homepage hash anchors.
 * Server components: the header is auth-aware via an RLS-scoped read.
 */

export async function MarketplaceHeader() {
  const viewer = await getViewer().catch(() => null);
  const dealer = viewer?.dealers[0] ?? null;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link href="/" className="shrink-0 text-xl font-bold text-slate-900">
            UsedCars<span className="text-orange-500">NZ</span>
          </Link>

          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto sm:gap-2">
            <NavLink href="/cars">Browse cars</NavLink>
            {dealer ? <NavLink href="/dealer">Dashboard</NavLink> : null}
            {viewer?.isAdmin ? <NavLink href="/admin">Admin</NavLink> : null}
            {!viewer ? (
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
                {!dealer ? (
                  <NavLink href="/register-dealer">List with us</NavLink>
                ) : null}
                <form action={signOutAction} className="inline shrink-0">
                  <button className="whitespace-nowrap px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:px-3">
                    Sign out
                  </button>
                </form>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="whitespace-nowrap px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:px-3"
    >
      {children}
    </Link>
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
          <p>Built for New Zealand dealerships.</p>
        </div>
      </div>
    </footer>
  );
}
