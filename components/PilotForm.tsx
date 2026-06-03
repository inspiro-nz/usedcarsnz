'use client'

import { useState, useEffect, useRef, type FormEvent } from 'react'

// NEXT_PUBLIC_ vars are inlined at build time — no API call needed
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''

const enquiryOptions = ['Under 20', '20–50', '50–100', '100–200', '200+']

function InputField({
  id,
  label,
  type = 'text',
  placeholder,
  required = true,
  autoComplete = 'off',
}: {
  id: string
  label: string
  type?: string
  placeholder: string
  required?: boolean
  autoComplete?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-orange-500" aria-hidden>*</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
      />
    </div>
  )
}

function SuccessState() {
  return (
    <section id="join" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900">
      <div className="max-w-lg mx-auto text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500 rounded-full mb-6 shadow-lg shadow-green-500/25">
          <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-white mb-4">You are on the list!</h2>
        <p className="text-slate-300 text-lg leading-relaxed">
          Thanks for your interest in the Founding Dealer Program. We will be in touch
          shortly to get you set up with a free onboarding call.
        </p>
      </div>
    </section>
  )
}

export default function PilotForm() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [turnstileReady, setTurnstileReady] = useState(false)
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null)
  const turnstileWidgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !turnstileContainerRef.current) return

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true

    script.onload = () => {
      if (!window.turnstile || !turnstileContainerRef.current) {
        setErrorMessage('Security verification failed. Please refresh and try again.')
        return
      }

      try {
        const widgetId = window.turnstile.render(turnstileContainerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'light',
          // Token is ready — unlock the submit button
          callback: () => setTurnstileReady(true),
          // Token expired (5 min timeout) — re-lock until re-verified
          'expired-callback': () => setTurnstileReady(false),
          'error-callback': () => {
            setErrorMessage('Security verification failed. Please refresh and try again.')
            setTurnstileReady(false)
          },
        })
        turnstileWidgetIdRef.current = widgetId
      } catch (error) {
        console.error('Failed to render Turnstile widget:', error)
        setErrorMessage('Security verification failed. Please refresh and try again.')
      }
    }

    script.onerror = () => {
      console.error('Failed to load Turnstile script')
      setErrorMessage('Security verification failed. Please refresh and try again.')
    }

    document.head.appendChild(script)

    return () => {
      if (document.head.contains(script)) document.head.removeChild(script)
      if (window.turnstile && turnstileWidgetIdRef.current) {
        window.turnstile.remove(turnstileWidgetIdRef.current)
      }
    }
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage(null)

    const token = window.turnstile?.getResponse(turnstileWidgetIdRef.current ?? undefined) ?? ''
    if (!token) {
      setErrorMessage('Please complete the security verification.')
      setStatus('error')
      return
    }

    const formData = new FormData(e.currentTarget)
    const payload = {
      name: String(formData.get('name') ?? '').trim(),
      dealership: String(formData.get('dealership') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim(),
      enquiries: String(formData.get('enquiries') ?? '').trim(),
      website: String(formData.get('website') ?? '').trim(),
      token,
    }

    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const body = await response.json()

      if (!response.ok) {
        setErrorMessage(body?.error ?? 'Unable to submit your request. Please try again.')
        setStatus('error')
        if (turnstileWidgetIdRef.current) window.turnstile?.reset(turnstileWidgetIdRef.current)
        return
      }

      setStatus('success')
    } catch (error) {
      console.error('Lead submission failed:', error)
      setErrorMessage('Network error. Please try again later.')
      setStatus('error')
      if (turnstileWidgetIdRef.current) window.turnstile?.reset(turnstileWidgetIdRef.current)
    }
  }

  if (status === 'success') return <SuccessState />

  const isSubmitDisabled = status === 'loading' || (!!TURNSTILE_SITE_KEY && !turnstileReady)

  return (
    <section id="join" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 text-orange-400 text-sm font-medium rounded-full mb-5">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" aria-hidden="true" />
            Limited to the first 10 dealerships
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Join the Founding Dealer Program
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed">
            Get early access, free setup support, and help shape the product that
            Kiwi dealers actually need.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          aria-live="polite"
          className="bg-white rounded-2xl p-6 sm:p-8 space-y-5"
        >
          <div className="grid sm:grid-cols-2 gap-5">
            <InputField id="name" label="Your Name" placeholder="John Smith" autoComplete="name" />
            <InputField id="dealership" label="Dealership Name" placeholder="ABC Motors" autoComplete="organization" />
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <InputField id="email" label="Email Address" type="email" placeholder="john@abcmotors.co.nz" autoComplete="email" />
            <InputField id="phone" label="Phone Number" type="tel" placeholder="021 123 4567" autoComplete="tel" required={false} />
          </div>

          <div>
            <label htmlFor="enquiries" className="block text-sm font-medium text-slate-700 mb-1.5">
              Monthly Enquiries <span className="text-orange-500" aria-hidden>*</span>
            </label>
            <div className="relative">
              <select
                id="enquiries"
                name="enquiries"
                required
                defaultValue=""
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition appearance-none bg-white pr-10"
              >
                <option value="" disabled>
                  How many enquiries do you receive per month?
                </option>
                {enquiryOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400" aria-hidden="true">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Honeypot — hidden from real users, catches autofill bots */}
          <input
            type="text"
            name="website"
            style={{ display: 'none' }}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          {TURNSTILE_SITE_KEY && (
            <div ref={turnstileContainerRef} id="turnstile-widget" className="flex justify-center" />
          )}

          {status === 'error' && errorMessage && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="w-full py-4 bg-orange-500 text-white font-bold text-lg rounded-xl hover:bg-orange-600 active:bg-orange-700 transition-colors shadow-lg shadow-orange-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {status === 'loading' ? 'Sending...' : 'Join the Founding Dealer Program'}
            </button>
            <p className="text-center text-xs text-slate-400 mt-3">
              Protected by Cloudflare Turnstile. No credit card. No commitment.
            </p>
          </div>
        </form>
      </div>
    </section>
  )
}
