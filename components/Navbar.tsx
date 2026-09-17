'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { navLinks } from '@/lib/nav'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { SIGNED_OUT, type ViewerSummary } from '@/lib/viewer-summary'

/**
 * Auth state is checked client-side (not via a server prop) so the homepage
 * stays statically prerendered — it's the conversion-critical landing page,
 * and a per-request Supabase round trip here would cost every visitor,
 * signed in or not, just to light up the nav.
 *
 * Fetches GET /api/viewer — the same role-shape endpoint the marketplace
 * header (components/marketplace/header-auth-nav.tsx) uses — rather than
 * checking only whether a session exists. A signed-in dealer landing back on
 * this page (e.g. clicking the logo) previously saw a generic buyer "My
 * account" link with no way back to their dealer dashboard; role is now known
 * here too, so the link goes to the right place.
 */
export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [viewer, setViewer] = useState<ViewerSummary>(SIGNED_OUT)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/viewer', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<ViewerSummary>) : SIGNED_OUT))
      .then((v) => setViewer(v))
      .catch(() => {
        if (!controller.signal.aborted) setViewer(SIGNED_OUT)
      })
    return () => controller.abort()
  }, [])

  const { signedIn, isDealer, isAdmin } = viewer
  const homeHref = isAdmin ? '/admin' : isDealer ? '/dealer' : '/account'
  const homeLabel = isAdmin ? 'Admin' : isDealer ? 'Dashboard' : 'My account'

  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  async function signOut() {
    await supabaseBrowser().auth.signOut()
    window.location.href = '/'
  }

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
            <Link
              href="/cars"
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium"
            >
              Browse cars
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {signedIn ? (
              <>
                <a
                  href={homeHref}
                  className="hidden sm:inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {homeLabel}
                </a>
                <button
                  onClick={signOut}
                  className="hidden sm:inline text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <a
                  href="/sign-in"
                  className="hidden sm:inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Sign in
                </a>
                <a
                  href="/sign-up"
                  className="hidden sm:inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Sign up
                </a>
              </>
            )}
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
            <Link
              href="/cars"
              onClick={() => setIsOpen(false)}
              className="px-2 py-2.5 text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors"
            >
              Browse cars
            </Link>
            {signedIn ? (
              <>
                <a
                  href={homeHref}
                  onClick={() => setIsOpen(false)}
                  className="px-2 py-2.5 text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors"
                >
                  {homeLabel}
                </a>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    signOut()
                  }}
                  className="w-full px-2 py-2.5 text-left text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <a
                  href="/sign-in"
                  onClick={() => setIsOpen(false)}
                  className="px-2 py-2.5 text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors"
                >
                  Sign in
                </a>
                <a
                  href="/sign-up"
                  onClick={() => setIsOpen(false)}
                  className="px-2 py-2.5 text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors"
                >
                  Sign up
                </a>
              </>
            )}
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
