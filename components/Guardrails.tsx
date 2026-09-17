import Link from "next/link"

const rules = [
  {
    title: 'Always labelled as an AI',
    description:
      'Every automated message says it comes from your AI assistant and that a person replies to anything about the vehicle itself.',
  },
  {
    title: 'Never a claim about the car',
    description:
      'The assistant does not describe condition, history, price, warranty, finance terms or availability. Those come from you, in a reply you approve.',
  },
  {
    title: 'Approval enforced in the database',
    description:
      'A drafted reply cannot be sent until an authorised person at your dealership approves it. That rule lives in the platform’s database, not in a policy document.',
  },
  {
    title: 'Buyer data handled under NZ privacy law',
    description:
      'Forwarded enquiry emails are processed under the pilot agreement. Raw emails are kept for 30 days for troubleshooting, then deleted automatically.',
  },
]

export default function Guardrails() {
  return (
    <section id="guardrails" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            What the AI will never do
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            A misrepresentation from an automated reply is your liability under the
            Fair Trading Act and Consumer Guarantees Act. So the assistant is
            deliberately boxed in.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {rules.map((rule) => (
            <div key={rule.title} className="flex gap-4 p-6 rounded-2xl border border-slate-100 bg-slate-50">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1.5">{rule.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{rule.description}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-slate-400 mt-8">
          Read our{' '}
          <Link href="/privacy" className="text-orange-500 hover:text-orange-600 font-medium transition-colors">
            privacy statement
          </Link>
          .
        </p>
      </div>
    </section>
  )
}
