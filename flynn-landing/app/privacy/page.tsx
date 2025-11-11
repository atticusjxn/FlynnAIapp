import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Flynn AI",
  description:
    "Learn how Flynn AI collects, uses, and protects voicemail, transcript, and customer data.",
};

const sections = [
  {
    title: "1. Information We Collect",
    content: (
      <div className="space-y-4 text-slate-600">
        <p>We collect the minimum information required to run Koala concierge effectively:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            <strong>Account & contact information</strong> such as name, email, company, and phone number when you create an account or contact support.
          </li>
          <li>
            <strong>Business configuration</strong> data like greeting scripts, intake questions, receptionist modes, acknowledgement phrases, and call-forwarding preferences.
          </li>
          <li>
            <strong>Call & voicemail data</strong> including caller ID, timestamps, voicemail audio, AI transcripts, summaries, and job notes once you forward calls to your Flynn number.
          </li>
          <li>
            <strong>Device & usage diagnostics</strong> such as push notification tokens, app version, and interaction logs so we can deliver notifications and improve stability.
          </li>
          <li>
            <strong>Optional voice samples</strong> if you record a custom concierge voice. We store the uploaded audio and derived embeddings until you delete the profile.
          </li>
        </ul>
      </div>
    ),
  },
  {
    title: "2. How We Use Information",
    content: (
      <div className="space-y-2 text-slate-600">
        <p>We use your data to:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Provision numbers, transcribe voicemails, and deliver job summaries to your team.</li>
          <li>Personalise scripts, voices, and notification flows based on your settings.</li>
          <li>Provide support, troubleshoot issues, and protect the security of the Service.</li>
          <li>Communicate onboarding tips, billing notices, and critical updates.</li>
        </ul>
        <p className="text-sm text-slate-500">We do not sell personal information to third parties.</p>
      </div>
    ),
  },
  {
    title: "3. Legal Bases",
    content: (
      <div className="space-y-2 text-slate-600">
        <p>
          Where required (e.g., GDPR), processing is based on performance of a contract, legitimate interests (improving reliability, stopping abuse), or consent (recording greetings, voice cloning, marketing updates).
        </p>
      </div>
    ),
  },
  {
    title: "4. Sharing & Processors",
    content: (
      <div className="space-y-2 text-slate-600">
        <p>
          We share data only with vendors that help us operate Flynn AI. Each provider is bound by contract to safeguard your data and use it only for the purposes described here.
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>Supabase for authentication, storage, and realtime data.</li>
          <li>Twilio for phone numbers, call forwarding, and voicemail collection.</li>
          <li>Stripe for billing and subscription management.</li>
          <li>Expo / Apple / Google for app delivery and notifications.</li>
          <li>OpenAI, Grok/X.ai, Azure Speech, and ElevenLabs for transcription & TTS.</li>
        </ul>
        <p>
          We may disclose information if required by law or to protect our rights, safety, or property.
        </p>
      </div>
    ),
  },
  {
    title: "5. Retention & Deletion",
    content: (
      <div className="space-y-2 text-slate-600">
        <ul className="list-disc space-y-2 pl-6">
          <li>Account data: retained while active and up to 24 months after cancellation.</li>
          <li>Voicemails & transcripts: retained for 90 days by default (shorter upon request).</li>
          <li>Custom voice samples: retained until you delete the profile or close your account.</li>
          <li>Diagnostics & analytics logs: retained up to 12 months.</li>
        </ul>
      </div>
    ),
  },
  {
    title: "6. Security",
    content: (
      <div className="space-y-2 text-slate-600">
        <p>
          We use TLS encryption, encryption at rest, access controls, and monitoring. No method is 100% secure, so please use strong passwords, enable device security, and alert us to any suspicious activity.
        </p>
      </div>
    ),
  },
  {
    title: "7. Your Rights",
    content: (
      <div className="space-y-2 text-slate-600">
        <p>
          Depending on your jurisdiction you may request access, correction, deletion, export, or restriction of your personal data, and withdraw consent at any time. Submit requests to {" "}
          <Link href="mailto:privacy@flynnai.com" className="font-medium text-indigo-600 underline">
            privacy@flynnai.com
          </Link>
          .
        </p>
      </div>
    ),
  },
  {
    title: "8. Children",
    content: (
      <p className="text-slate-600">
        Flynn AI is not directed to children under 16 and we do not knowingly collect data from them. If you believe a child provided data, contact us so we can delete it.
      </p>
    ),
  },
  {
    title: "9. International Transfers",
    content: (
      <p className="text-slate-600">
        Data is stored primarily in Australia and the United States and may be processed in other countries where we or our processors operate. We rely on contractual safeguards (e.g., SCCs) when required by law.
      </p>
    ),
  },
  {
    title: "10. Updates",
    content: (
      <p className="text-slate-600">
        We may update this policy from time to time. Material changes will be announced via email or in-app notice. Continued use after notice means you accept the updated policy.
      </p>
    ),
  },
  {
    title: "11. Contact",
    content: (
      <div className="space-y-2 text-slate-600">
        <p>Atticus Jackson</p>
        <p>11 Langside Road</p>
        <p>Hamilton QLD 4007, Australia</p>
        <p>
          Email: <Link href="mailto:atticusjxn@gmail.com" className="text-indigo-600 underline">atticusjxn@gmail.com</Link>
        </p>
        <p>Phone: +61 497 779 071</p>
      </div>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="bg-slate-50 py-16">
      <div className="mx-auto max-w-4xl space-y-12 px-6">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-wide text-slate-500">Legal</p>
          <h1 className="text-3xl font-semibold text-slate-900">Privacy Policy</h1>
          <p className="text-sm text-slate-500">Last updated: February 22, 2025</p>
          <p className="text-base text-slate-600">
            Flynn AI (“Flynn”, “we”, “our”) provides an AI concierge that captures missed calls and delivers structured job summaries. This policy explains how we collect, use, and protect information when you use our apps and services.
          </p>
        </header>
        <div className="space-y-10">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100"
            >
              <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
              <div className="mt-4 text-base leading-relaxed text-slate-700">
                {section.content}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
