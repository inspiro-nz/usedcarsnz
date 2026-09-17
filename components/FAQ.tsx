'use client'

import { useState } from 'react'

const faqs = [
  {
    question: 'What exactly does UsedCarsNZ do?',
    answer:
      'Two things. It answers every buyer enquiry in seconds, qualifies the buyer with a labelled AI assistant, and hands you a warm lead with a reply drafted for your approval. And it measures the result, so you can see your real first-response time and conversion instead of guessing.',
  },
  {
    question: 'Do I have to leave Trade Me?',
    answer:
      'No. Keep your Trade Me listings exactly as they are. The response tool works on the enquiries you already get there, via one email auto-forward rule. You can also co-list your stock on UsedCarsNZ at no cost, but that is optional.',
  },
  {
    question: 'Is this a marketplace or a tool?',
    answer:
      'Both, and you do not have to choose. UsedCarsNZ hosts listings and dealer pages that are built to be found by search engines and AI assistants, and the same platform answers and qualifies enquiries from wherever they arrive, including Trade Me.',
  },
  {
    question: 'Will an AI be talking to my buyers?',
    answer:
      'Only within tight limits. The instant acknowledgment is a fixed template, not AI-written. The assistant that follows is always labelled as an AI, asks qualification questions, and answers only routine generic questions from an approved list. Anything about the vehicle itself, price, warranty or finance is drafted for you and sent only after you approve it.',
  },
  {
    question: 'What does it cost?',
    answer:
      'The two-month pilot is free, with no fees, commissions or charges of any kind, and either side can end it on five working days’ notice. If we continue afterwards, the plan is flat and simple. No per-lead charges. You will know the price before you pay anything.',
  },
  {
    question: 'How is the proof measured?',
    answer:
      'Every acknowledgment, reply, appointment and sale is written to an append-only event log that cannot be edited, by us or anyone else. Your dashboard reads from that log, and so does the public platform number. Nothing is published until there are enough measured responses for the figure to be honest.',
  },
  {
    question: 'What happens to buyer information?',
    answer:
      'Forwarded enquiry emails are processed under the pilot agreement and New Zealand privacy law. The raw email is kept for 30 days for troubleshooting, then deleted automatically. If the pilot ends, you can ask us to delete or de-identify the buyer data we processed for you.',
  },
  {
    question: 'How long does setup take?',
    answer:
      'About three minutes. We give you a private forwarding address, you add one rule in Gmail or Outlook, and leads start flowing. No DMS migration, no re-keying, no staff retraining.',
  },
  {
    question: 'How many Founding Dealer spots are there?',
    answer:
      'Ten, starting with Christchurch dealerships so the founder can visit in person. Founding dealers get hands-on support, first use of new tools, and a direct say in what gets built next.',
  },
]

function FAQItem({ id, question, answer }: { id: string; question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-6 py-5 text-left group"
        aria-expanded={isOpen}
        aria-controls={id}
      >
        <span className="font-semibold text-slate-900 group-hover:text-orange-600 transition-colors text-sm sm:text-base">
          {question}
        </span>
        <span
          aria-hidden="true"
          className={`flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 transition-transform ${
            isOpen ? 'rotate-180 bg-orange-100 text-orange-600' : ''
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {isOpen && (
        <div id={id} className="pb-5 text-slate-500 leading-relaxed text-sm pr-10">
          {answer}
        </div>
      )}
    </div>
  )
}

export default function FAQ() {
  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-slate-500">
            Everything you need to know before joining the Founding Dealer Program.
          </p>
        </div>

        <div className="bg-white rounded-2xl px-6 sm:px-8 shadow-sm border border-slate-100">
          {faqs.map((faq, index) => (
            <FAQItem key={faq.question} id={`faq-answer-${index}`} {...faq} />
          ))}
        </div>

        <p className="text-center text-sm text-slate-400 mt-8">
          Still have questions?{' '}
          <a href="#join" className="text-orange-500 hover:text-orange-600 font-medium transition-colors">
            Get in touch when you register.
          </a>
        </p>
      </div>
    </section>
  )
}
