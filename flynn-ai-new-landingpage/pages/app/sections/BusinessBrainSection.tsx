import React, { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabase';

interface Service {
  name: string;
  description?: string;
}

interface BusinessProfile {
  business_name?: string;
  industry?: string;
  services?: Service[];
  pricing_notes?: string;
  hours?: string;
  service_area?: string;
}

export default function BusinessBrainSection() {
  const [profile, setProfile] = useState<BusinessProfile>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (data) setProfile(data);
    }
    load();
  }, []);

  async function save() {
    setSaving(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error: err } = await supabase
        .from('business_profiles')
        .upsert({ ...profile, user_id: user.id }, { onConflict: 'user_id' });
      if (err) throw new Error(err.message);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function setField(key: keyof BusinessProfile, value: string) {
    setProfile(p => ({ ...p, [key]: value }));
    setSaved(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Business Brain</h1>
      <p className="text-sm text-gray-500 mb-8">
        Flynn uses this context in every draft, pricing, services, and your service area
        make replies sound specific to your business.
      </p>

      <div className="space-y-5">
        <Field label="Business name" value={profile.business_name ?? ''}
          onChange={v => setField('business_name', v)} placeholder="e.g. Gold Coast Plumbing" />
        <Field label="Industry / trade" value={profile.industry ?? ''}
          onChange={v => setField('industry', v)} placeholder="e.g. Plumber, PT, Real Estate" />
        <Field label="Services" value={profile.services?.map(s => s.name).join(', ') ?? ''}
          onChange={v => setProfile(p => ({ ...p, services: v.split(',').map(s => ({ name: s.trim() })).filter(s => s.name) }))}
          placeholder="e.g. Hot water, blocked drains, leak repairs" />
        <Field label="Pricing notes" value={profile.pricing_notes ?? ''}
          onChange={v => setField('pricing_notes', v)}
          placeholder="e.g. $120/hr call-out, fixed quotes for installs"
          multiline />
        <Field label="Hours" value={profile.hours ?? ''}
          onChange={v => setField('hours', v)} placeholder="e.g. Mon–Fri 7am–5pm, emergency Sat" />
        <Field label="Service area" value={profile.service_area ?? ''}
          onChange={v => setField('service_area', v)} placeholder="e.g. Gold Coast & Northern NSW" />
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="mt-8 px-6 py-2.5 bg-[#FB5B1E] text-white font-semibold rounded border-2 border-black shadow-[3px_3px_0_black] hover:shadow-[1px_1px_0_black] hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
      </button>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean;
}) {
  const base = 'w-full border-2 border-black rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FB5B1E]';
  return (
    <div>
      <label className="block text-sm font-semibold mb-1">{label}</label>
      {multiline ? (
        <textarea rows={3} className={base} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input className={base} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}
