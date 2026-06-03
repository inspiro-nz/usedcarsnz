const stats = [
  { value: '< 2 min', label: 'Target response time' },
  { value: 'Free', label: 'For founding members' },
  { value: '10', label: 'Limited dealer spots' },
]

export default function Hero() {
  return (
    <section className="relative bg-slate-900 text-white pt-28 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 20% 60%, #f97316 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #3b82f6 0%, transparent 45%)',
        }}
      />

      <div className="relative max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 text-orange-400 text-sm font-medium rounded-full mb-8">
          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" aria-hidden="true" />
          Founding Dealer Program — Limited Availability
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-6">
          Help every enquiry get a professional response,
          <span className="block text-orange-400 mt-1">even after hours.</span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          UsedCarsNZ helps New Zealand dealerships capture more buyer enquiries with
          faster responses and smarter follow-up.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#join"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-orange-500 text-white font-bold text-lg rounded-xl hover:bg-orange-600 active:bg-orange-700 transition-colors shadow-lg"
          >
            Join the Founding Dealer Program
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 border border-slate-600 text-slate-300 font-medium text-lg rounded-xl hover:border-slate-400 hover:text-white transition-colors"
          >
            See How It Works
          </a>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 divide-x divide-slate-700 max-w-xl mx-auto border border-slate-700 rounded-2xl overflow-hidden">
          {stats.map((stat) => (
            <div key={stat.label} className="px-4 py-5 text-center bg-slate-800/60">
              <div className="text-2xl sm:text-3xl font-bold text-orange-400 tabular-nums">
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm text-slate-400 mt-1 leading-snug">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
