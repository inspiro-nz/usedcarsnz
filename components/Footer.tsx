import Link from "next/link"
import { navLinks } from "@/lib/nav"

const platformLinks = [
  { href: '/cars', label: 'Browse cars' },
  { href: '/metrics', label: 'The number we publish' },
  { href: '/sign-in', label: 'Dealer sign in' },
  { href: '/privacy', label: 'Privacy' },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-slate-950 text-slate-400 py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-10">
          <div className="max-w-xs">
            <a href="#top" aria-label="Scroll to top" className="text-xl font-bold text-white inline-block mb-3">
              UsedCars<span className="text-orange-500">NZ</span>
            </a>
            <p className="text-sm leading-relaxed">
              Keep your Trade Me listing, add us. Every enquiry answered in under a
              minute, qualified, handed to you warm, and measured.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              On this page
            </p>
            <nav className="flex flex-col gap-2.5">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm hover:text-white transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Platform
            </p>
            <nav className="flex flex-col gap-2.5">
              {platformLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Program
            </p>
            <a
              href="#join"
              className="text-sm text-orange-400 hover:text-orange-300 font-medium transition-colors"
            >
              Join the Founding Dealer Program
            </a>
            <p className="text-sm">Free two-month pilot. Christchurch first.</p>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <p>&copy; {year} UsedCarsNZ, a product of Inspiral NZ Ltd. All rights reserved.</p>
          <p>Built for New Zealand dealerships.</p>
        </div>
      </div>
    </footer>
  )
}
