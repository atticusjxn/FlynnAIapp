import React, { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabase';

interface AcceptedDraft {
  id: string;
  text: string;
  created_at: string;
  source: string;
}

export default function LearnedSection() {
  const [drafts, setDrafts] = useState<AcceptedDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [forgetting, setForgetting] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setLoading(false);
      const { data } = await supabase
        .from('accepted_drafts')
        .select('id, text, created_at, source')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setDrafts(data);
      setLoading(false);
    }
    load();
  }, []);

  async function forgetEverything() {
    if (!confirm('This deletes all your accepted drafts and voice profile. Flynn will start fresh. Are you sure?')) return;
    setForgetting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await Promise.all([
        supabase.from('accepted_drafts').delete().eq('user_id', user.id),
        supabase.from('voice_profiles').delete().eq('user_id', user.id),
      ]);
    }
    setDrafts([]);
    setForgetting(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">What Flynn Learned</h1>
      <p className="text-sm text-gray-500 mb-8">
        Every draft you insert teaches Flynn your voice and substance preferences.
        The last 20 accepted drafts are shown below.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : drafts.length === 0 ? (
        <div className="bg-white border-2 border-black rounded p-6 text-center text-sm text-gray-500">
          No accepted drafts yet. Insert your first draft to start building your voice profile.
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map(d => (
            <div key={d.id} className="bg-white border-2 border-black rounded p-4">
              <p className="text-sm text-gray-800 leading-relaxed">"{d.text}"</p>
              <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-wide">
                {d.source} · {new Date(d.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 pt-6 border-t-2 border-black">
        <h2 className="text-sm font-semibold text-red-700 mb-1">Danger zone</h2>
        <p className="text-xs text-gray-500 mb-4">
          Deletes all accepted drafts and your voice profile. Flynn starts fresh.
          This cannot be undone.
        </p>
        <button
          onClick={forgetEverything}
          disabled={forgetting}
          className="text-sm font-medium text-red-600 border-2 border-red-400 rounded px-4 py-2 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {forgetting ? 'Deleting…' : 'Forget everything'}
        </button>
      </div>
    </div>
  );
}
