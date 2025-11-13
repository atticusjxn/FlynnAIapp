import Link from "next/link";

export const metadata = {
  title: "Delete your account | Flynn AI",
  description: "Instructions for deleting your Flynn AI account and requesting data removal.",
};

const steps = [
  {
    title: "Submit the request",
    body: (
      <p>
        Email our privacy team at{" "}
        <Link href="mailto:privacy@flynnai.com?subject=Delete%20my%20Flynn%20AI%20account" className="font-medium text-indigo-600 underline">
          privacy@flynnai.com
        </Link>{" "}
        using the email address tied to your Flynn AI account. You can also send the request from the mobile app by going to
        <span className="font-medium"> Settings → Support → Contact Support</span>.
      </p>
    ),
  },
  {
    title: "Verify ownership",
    body: (
      <p>
        Include your business name, the phone number provisioned inside Flynn AI, and the phrase “Account deletion request”. We&apos;ll reply if we need additional verification or to confirm the request came from an authorized owner.
      </p>
    ),
  },
  {
    title: "We delete your data",
    body: (
      <p>
        Within 5 business days we will deactivate the account, delete Supabase authentication data, remove voicemail audio/transcripts, and confirm completion via email. You will receive a final confirmation once the deletion is finished.
      </p>
    ),
  },
];

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-16">
      <div className="mx-auto max-w-3xl rounded-3xl bg-white px-6 py-12 shadow-xl sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Data privacy</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Delete your Flynn AI account</h1>
        <p className="mt-4 text-base text-slate-600">
          We make it simple to close your account and remove the data stored in Flynn AI. Follow the steps below or reach out anytime if you need help.
        </p>

        <div className="mt-8 space-y-6">
          {steps.map(step => (
            <div key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6">
              <h2 className="text-lg font-semibold text-slate-900">{step.title}</h2>
              <div className="mt-2 text-slate-600">{step.body}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl bg-slate-900 px-6 py-8 text-slate-100">
          <h2 className="text-xl font-semibold">Need a faster response?</h2>
          <p className="mt-2 text-slate-300">
            Tap the button below to pre-fill an email to our privacy team. We typically respond within one business day.
          </p>
          <Link
            href="mailto:privacy@flynnai.com?subject=Delete%20my%20Flynn%20AI%20account"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:scale-[1.01]"
          >
            Email privacy@flynnai.com
          </Link>
        </div>

        <p className="mt-8 text-sm text-slate-500">
          Once your deletion is complete, your concierge number is released and all voicemail audio, transcripts, summaries, and custom receptionist settings are permanently removed.
        </p>
      </div>
    </main>
  );
}
