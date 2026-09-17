import Link from "next/link"

const measures = [
  {
    label: 'Median first response',
    detail: 'From the moment an enquiry arrives to the moment the buyer hears back.',
  },
  {
    label: 'Enquiry to appointment',
    detail: 'The share of enquiries that turn into a booked viewing or test drive.',
  },
  {
    label: 'Appointment to sale',
    detail: 'The share of those appointments that end in a sold vehicle.',
  },
]

export default function Proof() {
  return (
    <section id="proof" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900 text-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-orange-400 mb-3">
            Proof, not promises
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            We publish the numbers
          </h2>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Every acknowledgment, appointment and sale is written to an append-only
            log that nobody, including us, can edit. Your dashboard and our public
            metric both read from it. The public number stays hidden until there
            are enough measured responses for it to be honest.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {measures.map((m) => (
            <div key={m.label} className="rounded-2xl border border-slate-700 bg-slate-800/60 p-6">
              <h3 className="font-bold text-white mb-1.5">{m.label}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{m.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/metrics"
            className="inline-flex items-center gap-2 px-6 py-3 border border-slate-600 text-slate-200 font-medium rounded-xl hover:border-slate-400 hover:text-white transition-colors"
          >
            See the platform number
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  )
}
