import Link from "next/link";

const footerLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/delete-account", label: "Delete account" },
  { href: "/support", label: "Support" },
];

export default function Footer() {
  return (
    <footer className="bg-slate-900 py-10 text-slate-200">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-semibold tracking-wide text-white">Flynn AI</p>
          <p className="text-sm text-slate-400">
            Koala concierge for event & service teams. Never miss another lead.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-6 max-w-6xl px-6">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          © {new Date().getFullYear()} Flynn AI Pty Ltd. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
