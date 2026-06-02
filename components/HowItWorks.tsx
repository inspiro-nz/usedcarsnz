const steps = [
  {
    number: '01',
    title: 'Enquiry Arrives',
    description:
      "A buyer submits a vehicle enquiry through your existing channels — Trade Me, your website, or any enquiry form you use.",
  },
  {
    number: '02',
    title: 'Dealer Is Notified',
    description:
      'UsedCarsNZ instantly alerts the right person at your dealership — no logging into dashboards, no checking email queues.',
  },
  {
    number: '03',
    title: 'Faster Follow-Up',
    description:
      "Your team responds while the buyer's interest is at its peak. No missed notifications, no next-day catch-ups.",
  },
  {
    number: '04',
    title: 'More Opportunities Captured',
    description:
      'By responding faster than your competition, you convert more enquiries into conversations — and more conversations into sales.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            How It Works
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            A simple process designed to fit into how your dealership already operates.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <div key={step.number} className="relative flex flex-col items-center text-center">
              {index < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className="hidden lg:block absolute top-7 left-[calc(50%+2rem)] right-[calc(-50%+2rem)] h-px bg-slate-200"
                />
              )}
              <div className="w-14 h-14 rounded-full bg-orange-500 text-white font-bold text-lg flex items-center justify-center shadow-lg shadow-orange-200 mb-5 z-10">
                {step.number}
              </div>
              <h3 className="font-bold text-slate-900 mb-2 text-base">{step.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
