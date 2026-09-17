const problems = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Enquiries wait hours, not minutes',
    description:
      'Most online enquiries land while the sales desk is busy or closed. Around six in ten arrive after hours. By the time someone replies, the buyer has moved on.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Buyers enquire with several dealers at once',
    description:
      'The first yard to answer usually gets the conversation. The rest are competing for a second look that rarely comes.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      </svg>
    ),
    title: 'One platform, rising fees',
    description:
      'Trade Me Motors holds most of the market and has restructured dealer listing pricing upward. There is no real alternative to add alongside it.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Nobody can show you the numbers',
    description:
      'How fast do your enquiries actually get answered? How many turn into appointments and sales? Most dealers are guessing, and every platform asks you to take its word for it.',
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
            Speed to lead is the one lever a dealership controls, and the one most
            yards are not set up for.
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
