export const metadata = {
  title: "Support | Flynn AI",
  description:
    "Get help with Flynn AI. Contact our team for account, billing, or concierge questions.",
};

const contacts = [
  { label: "Email", value: "admin@mates-rates.app", href: "mailto:admin@mates-rates.app" },
  { label: "Phone", value: "0497779071", href: "tel:0497779071" },
  { label: "Contact", value: "Atticus Jackson" },
];

const commonRequests = [
  { title: "Can't sign in", body: "Use the credentials provided by your admin. For resets, email us with your organization name." },
  {
    title: "Concierge/call issues",
    body: "Include time of the call, caller number, and what you expected. We’ll review the intake and summary.",
  },
  {
    title: "App crashes or won’t load",
    body: "Force close and reopen. If it persists, share device model, iOS version, and steps to reproduce.",
  },
];

export default function SupportPage() {
  return (
    <main className="bg-slate-900 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 py-16">
        <header>
          <p className="text-sm uppercase tracking-wide text-slate-400">Support</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">We’re here to help</h1>
          <p className="mt-3 text-slate-300">
            If you’re having trouble with Flynn AI or need to report an issue, use the contacts below. We aim to respond within one business day and keep updates flowing every 48 hours on open tickets.
          </p>
        </header>

        <section className="grid gap-4 rounded-2xl bg-slate-800/60 p-6 shadow-lg ring-1 ring-white/5 sm:grid-cols-2">
          <div>
            <h2 className="text-lg font-semibold text-white">Contact</h2>
            <ul className="mt-3 space-y-2 text-slate-200">
              {contacts.map((item) => (
                <li key={item.label} className="flex gap-2">
                  <span className="w-20 text-slate-400">{item.label}:</span>
                  {item.href ? (
                    <a href={item.href} className="text-blue-400 hover:text-blue-300">
                      {item.value}
                    </a>
                  ) : (
                    <span>{item.value}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Privacy</h2>
            <p className="mt-3 text-slate-300">
              We only use call and intake data to operate the concierge experience. For any data deletion or export requests, reach out at the email above.
            </p>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-slate-800/60 p-6 shadow-lg ring-1 ring-white/5">
          <h2 className="text-lg font-semibold text-white">Common requests</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {commonRequests.map((item) => (
              <div key={item.title} className="rounded-xl bg-slate-800 p-4 ring-1 ring-white/5">
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-blue-600/90 p-6 text-white shadow-lg">
          <h2 className="text-lg font-semibold">Response times</h2>
          <p className="mt-2">
            We aim to respond within one business day for new tickets and provide updates on open issues every 48 hours.
          </p>
        </section>
      </div>
    </main>
  );
}
