export function Settings() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </header>

      <section className="panel p-5 space-y-3">
        <h2 className="text-lg font-semibold">Daily commands</h2>
        <p className="text-sm text-muted">Run from <code>FlynnAIapp/gtm-automation/</code>:</p>
        <ul className="space-y-2 text-sm">
          <li>
            <code className="rounded bg-zinc-900 px-2 py-1">npm run brief</code>
            <span className="ml-2 text-muted">— write today's brief email + log</span>
          </li>
          <li>
            <code className="rounded bg-zinc-900 px-2 py-1">npm run scrape</code>
            <span className="ml-2 text-muted">— scrape Yellow Pages AU into gtm_cold_leads</span>
          </li>
          <li>
            <code className="rounded bg-zinc-900 px-2 py-1">npm run send:batch</code>
            <span className="ml-2 text-muted">— fire today's cold-email queue (30 cap)</span>
          </li>
          <li>
            <code className="rounded bg-zinc-900 px-2 py-1">npm run gmail:oauth</code>
            <span className="ml-2 text-muted">— one-time Gmail consent</span>
          </li>
          <li>
            <code className="rounded bg-zinc-900 px-2 py-1">npm run seed:fb-groups</code>
            <span className="ml-2 text-muted">— seed gtm_fb_groups from CSV</span>
          </li>
        </ul>
      </section>

      <section className="panel p-5 space-y-3">
        <h2 className="text-lg font-semibold">Cron schedule</h2>
        <p className="text-sm text-muted">
          GitHub Actions runs <code>.github/workflows/morning-brief.yml</code> daily at 21:30 UTC
          (07:30 AEST winter / 08:30 AEDT summer).
        </p>
      </section>

      <section className="panel p-5 space-y-3">
        <h2 className="text-lg font-semibold">Mac auto-open</h2>
        <p className="text-sm text-muted">
          Run <code>./gtm-dashboard/setup-mac-autostart.sh</code> once. Sets Chrome's startup tab
          to this dashboard and adds Chrome to Login Items.
        </p>
      </section>
    </div>
  );
}
