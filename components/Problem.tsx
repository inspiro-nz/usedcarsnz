const problems = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    title: 'Missed Enquiries',
    description:
      "Buyers send enquiries and move on when nobody responds quickly. By the time a dealer follows up, the lead is cold — or gone to a competitor who replied first.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Delayed Responses',
    description:
      "Between showroom traffic, admin, and after-hours gaps, responding to online enquiries falls to the bottom of the list. Buyers don't wait around.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Buyers Contact Multiple Dealers',
    description:
      "Today's car buyer submits enquiries to 3–5 dealerships simultaneously. Whoever responds first wins the conversation. Whoever responds last rarely gets a second chance.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      </svg>
    ),
    title: 'Lost Sales Opportunities',
    description:
      'Every delayed response is a potential sale handed to the competition. The cost of slow follow-up compounds across every enquiry, every day.',
  },
]

export default function Problem() {
  return (
    <section id="problem" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            The Problem Dealers Face Every Day
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Online enquiries are time-sensitive. Most dealerships aren&apos;t set up to
            respond at the speed buyers now expect.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {problems.map((problem) => (
            <div
              key={problem.title}
              className="flex gap-4 p-6 rounded-2xl border border-slate-100 bg-slate-50 hover:border-red-100 hover:bg-red-50/40 transition-all"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-red-100 text-red-500 flex items-center justify-center">
                {problem.icon}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1.5">{problem.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{problem.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
