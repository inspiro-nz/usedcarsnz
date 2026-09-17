const steps = [
  {
    number: '01',
    title: 'Connect your enquiries',
    description:
      'Set one auto-forward rule so a copy of each Trade Me enquiry email reaches your private UsedCarsNZ address. About three minutes, once. Co-list your stock here too, at no cost.',
  },
  {
    number: '02',
    title: 'Instant acknowledgment, 24/7',
    description:
      'Every buyer gets a short, templated reply within seconds, sent as your dealership. Not written by an AI model, so it never says anything about the car.',
  },
  {
    number: '03',
    title: 'Qualified, then drafted for you',
    description:
      'A clearly labelled AI assistant asks about budget, finance, trade-in and timing, then drafts your reply. Nothing substantive is sent until someone at your yard approves it.',
  },
  {
    number: '04',
    title: 'Warm lead, measured result',
    description:
      'The lead lands in your inbox with the conversation attached. First-response time, enquiry to appointment and appointment to sale are all recorded on your dashboard.',
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
            You keep doing exactly what you do now. We sit on top of your existing
            enquiry flow.
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
