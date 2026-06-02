'use client'

import { useState } from 'react'

const faqs = [
  {
    question: 'What exactly does UsedCarsNZ do?',
    answer:
      "UsedCarsNZ is a response speed tool for dealerships. When a buyer sends a vehicle enquiry, we make sure the right person at your dealership is notified immediately — so you can follow up before the buyer moves on. We don't build your website, list your cars, or manage your inventory.",
  },
  {
    question: 'Is this a listing site or marketplace?',
    answer:
      "No. UsedCarsNZ is not a marketplace, not a listing site, and not a dealer website builder. We work alongside the platforms you already use — like Trade Me Motors — by helping you respond to those enquiries faster.",
  },
  {
    question: 'How is this different from just using email?',
    answer:
      "Email gets buried. By the time you see an enquiry, it may be hours old. UsedCarsNZ delivers real-time alerts so you can respond in minutes, not hours or the next business day. Speed is the entire point.",
  },
  {
    question: 'What does the Christchurch pilot involve?',
    answer:
      "The pilot is a limited-access programme for Christchurch dealerships. You get free setup, dedicated support, and direct input into the product roadmap. In return, we ask for honest feedback as we refine the platform. There are no fees during the pilot.",
  },
  {
    question: 'Do I need to change how my dealership operates?',
    answer:
      "Minimal change required. UsedCarsNZ fits into your existing workflow — you don't need to migrate listings, change your website, or retrain staff on a new CRM. We work with what you already have.",
  },
  {
    question: 'How many pilot spots are available?',
    answer:
      "We are keeping the Christchurch pilot small — around 10–15 dealerships — so we can provide hands-on support to each one. Spots are limited, so we recommend registering your interest now.",
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
            Everything you need to know before joining the pilot.
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
