import React from 'react';
import type { Manifest } from '../lib/api';
import { widgetFor } from '../widgets/registry';
import ActionButton from '../widgets/ActionButton';

/** Hero block — the headline proactive prompt. */
function Hero({ manifest }: { manifest: Manifest }) {
  const { hero } = manifest;
  return (
    <section className="card card-md bg-brand-500 text-white border-neutral-900 mb-6">
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide opacity-80">{manifest.business_label || 'your business'}</span>
        <h2 className="h-display text-2xl">{hero.title}</h2>
        {hero.body && <p className="text-base opacity-95">{hero.body}</p>}
        {hero.cta && <div className="pt-2"><ActionButton action={hero.cta} variant="outline" /></div>}
      </div>
    </section>
  );
}

export default function ManifestRenderer({ manifest }: { manifest: Manifest }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Hero manifest={manifest} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {manifest.modules.map((m) => {
          const Widget = widgetFor(m.type);
          return <Widget key={m.id} module={m} />;
        })}
      </div>
    </div>
  );
}
