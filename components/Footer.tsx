const navLinks = [
  { href: '#problem', label: 'The Problem' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#why-join', label: 'Why Join' },
  { href: '#faq', label: 'FAQ' },
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
              Helping Kiwi dealerships respond faster and capture more sales
              opportunities before the competition does.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Navigation
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
              Program
            </p>
            <a
              href="#join"
              className="text-sm text-orange-400 hover:text-orange-300 font-medium transition-colors"
            >
              Join the Founding Dealer Program
            </a>
            <p className="text-sm">New Zealand dealerships welcome</p>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <p>&copy; {year} UsedCarsNZ. All rights reserved.</p>
          <p>Built for New Zealand dealerships.</p>
        </div>
      </div>
    </footer>
  )
}
