'use client'

import { useState } from 'react'

const navLinks = [
  { href: '#problem', label: 'The Problem' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#why-join', label: 'Why Join' },
  { href: '#faq', label: 'FAQ' },
]

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="#top" className="text-xl font-bold text-slate-900">
            UsedCars<span className="text-orange-500">NZ</span>
          </a>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <a
              href="#join"
              className="hidden sm:inline-flex items-center px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors"
            >
              Join Program
            </a>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 transition-colors"
              aria-label="Toggle navigation menu"
              aria-controls="mobile-navigation"
              aria-expanded={isOpen}
            >
              {isOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {isOpen && (
          <div id="mobile-navigation" className="md:hidden border-t border-slate-100 py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="px-2 py-2.5 text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#join"
              onClick={() => setIsOpen(false)}
              className="mt-2 flex items-center justify-center px-4 py-3 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors"
            >
              Join the Founding Dealer Program
            </a>
          </div>
        )}
      </div>
    </nav>
  )
}
