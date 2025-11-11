import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Flynn AI",
  description: "Read the terms that govern your use of Flynn AI and the Koala concierge experience.",
};

const sections = [
  {
    title: "1. Accounts & Security",
    text: [
      "Provide accurate information, keep your credentials secure, and notify us of unauthorised use.",
      "We may suspend accounts that violate these terms or disrupt other users.",
    ],
  },
  {
    title: "2. Using Flynn AI",
    text: [
      "Flynn AI provisions numbers, captures missed calls, transcribes audio, and drafts summaries.",
      "You are responsible for obtaining any caller consent required to record or transcribe audio in your jurisdiction.",
      "Do not misuse the Service (attempting to access other users’ data, reverse engineering components, or uploading malicious content).",
    ],
  },
  {
    title: "3. Subscriptions & Payments",
    text: [
      "Paid tiers (Concierge Basic/Growth) are billed via Stripe. Plans renew automatically unless cancelled at least 24 hours before renewal.",
      "By subscribing you authorise Flynn and Stripe to charge the payment method on file.",
      "Fees are non-refundable except where required by law. We may issue prorated credits if we materially fail to deliver the Service.",
    ],
  },
  {
    title: "4. Content & Caller Data",
    text: [
      "You retain ownership of call recordings, transcripts, and job notes.",
      "You grant Flynn a limited licence to process that data solely to provide and improve the Service.",
      "You must not submit content that is illegal, infringing, abusive, or violates privacy rights.",
    ],
  },
  {
    title: "5. Third-Party Services",
    text: [
      "The Service integrates with third parties (Twilio, Supabase, Stripe, LLM/TTS vendors). Their terms may also apply.",
      "Flynn is not responsible for outages or acts of third parties, but we work to mitigate disruptions.",
    ],
  },
  {
    title: "6. Intellectual Property",
    text: [
      "Flynn and its licensors own all rights in the Service, including Koala concierge branding and software.",
      "You may not copy, modify, distribute, or create derivative works based on the Service except as allowed in these terms.",
    ],
  },
  {
    title: "7. Disclaimers",
    text: [
      "THE SERVICE IS PROVIDED “AS IS” WITHOUT WARRANTIES OF ANY KIND. Flynn does not guarantee that AI outputs will be error-free or that the Service will be uninterrupted.",
      "You are responsible for verifying summaries and drafts before acting on them.",
    ],
  },
  {
    title: "8. Limitation of Liability",
    text: [
      "TO THE MAXIMUM EXTENT PERMITTED BY LAW, FLYNN WILL NOT BE LIABLE FOR INDIRECT OR CONSEQUENTIAL DAMAGES OR FOR LOSS OF PROFITS, DATA, OR BUSINESS.",
      "Our total liability for any claim will not exceed the amounts you paid during the 12 months prior to the claim.",
    ],
  },
  {
    title: "9. Cancellation & Suspension",
    text: [
      "You may cancel your subscription at any time via the app or by emailing support@flynnai.com. Access remains until the end of the paid term.",
      "We may suspend or terminate accounts that breach these terms or fail to pay fees (we’ll give notice where possible).",
    ],
  },
  {
    title: "10. Changes",
    text: [
      "We may modify the Service or update these terms. Material changes will be announced via email or in-app notice.",
      "Continued use after changes take effect constitutes acceptance.",
    ],
  },
  {
    title: "11. Governing Law",
    text: [
      "These terms are governed by the laws of Victoria, Australia, and disputes will be resolved in Melbourne courts (unless local law requires otherwise).",
    ],
  },
  {
    title: "12. Contact",
    text: [
      "Atticus Jackson",
      "11 Langside Road",
      "Hamilton QLD 4007, Australia",
      "Email: atticusjxn@gmail.com",
      "Phone: +61 497 779 071",
    ],
  },
];

export default function TermsPage() {
  return (
    <main className="bg-slate-50 py-16">
      <div className="mx-auto max-w-4xl space-y-12 px-6">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-wide text-slate-500">Legal</p>
          <h1 className="text-3xl font-semibold text-slate-900">Terms of Service</h1>
          <p className="text-sm text-slate-500">Last updated: February 22, 2025</p>
          <p className="text-base text-slate-600">
            These terms govern your use of Flynn AI and the Koala concierge experience. By creating an account or using the Service you agree to the rules below.
          </p>
        </header>
        <div className="space-y-10">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100"
            >
              <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
              <ul className="mt-4 list-disc space-y-2 pl-6 text-base leading-relaxed text-slate-700">
                {section.text.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="text-sm text-slate-500">
          Questions? Email {" "}
          <Link href="mailto:atticusjxn@gmail.com" className="text-indigo-600 underline">
            atticusjxn@gmail.com
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
