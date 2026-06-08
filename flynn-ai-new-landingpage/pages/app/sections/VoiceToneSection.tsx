import React, { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabase';

const TONE_TAGS = ['Direct', 'Warm', 'Formal', 'Casual', 'Concise', 'Detailed', 'Friendly', 'Professional'];

interface VoiceProfile {
  tone_tags?: string[];
  tone_notes?: string;
  example_replies?: string[];
}

export default function VoiceToneSection() {
  const [profile, setProfile] = useState<VoiceProfile>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('voice_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (data) setProfile(data);
    }
    load();
  }, []);

  function toggleTag(tag: string) {
    const current = profile.tone_tags ?? [];
    const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    setProfile(p => ({ ...p, tone_tags: next }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('voice_profiles')
        .upsert({ ...profile, user_id: user.id }, { onConflict: 'user_id' });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Voice & Tone</h1>
      <p className="text-sm text-gray-500 mb-8">
        Flynn learns your voice from the drafts you accept. Use these settings to steer it
        faster, especially useful in the first week.
      </p>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-3">Tone tags</h2>
        <div className="flex flex-wrap gap-2">
          {TONE_TAGS.map(tag => {
            const active = (profile.tone_tags ?? []).includes(tag);
            return (
              <button key={tag} onClick={() => toggleTag(tag)}
                className={[
                  'px-3 py-1 rounded-full text-sm font-medium border-2 border-black transition-colors',
                  active ? 'bg-[#FB5B1E] text-white' : 'bg-white text-gray-700 hover:bg-[#F4E6CE]',
                ].join(' ')}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-8">
        <label className="block text-sm font-semibold mb-1">Tone notes (optional)</label>
        <textarea
          rows={3}
          className="w-full border-2 border-black rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FB5B1E]"
          placeholder='e.g. "Never say mate. Keep it under 3 sentences. Always end with a question."'
          value={profile.tone_notes ?? ''}
          onChange={e => { setProfile(p => ({ ...p, tone_notes: e.target.value })); setSaved(false); }}
        />
      </section>

      <p className="text-xs text-gray-400 mb-6">
        Flynn also learns passively from the drafts you choose to insert, no extra work needed.
      </p>

      <button
        onClick={save}
        disabled={saving}
        className="px-6 py-2.5 bg-[#FB5B1E] text-white font-semibold rounded border-2 border-black shadow-[3px_3px_0_black] hover:shadow-[1px_1px_0_black] hover:translate-x-0.5 hover:translate-y-0.5 transition-all disabled:opacity-50"
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
      </button>
    </div>
  );
}
