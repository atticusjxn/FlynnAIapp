import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../services/supabase';

export default function AccountSection() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>('Free');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setEmail(user.email ?? null);
    });
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Account</h1>
      <p className="text-sm text-gray-500 mb-8">Manage your Flynn account and plan.</p>

      <div className="bg-white border-2 border-black rounded divide-y-2 divide-black">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm font-medium text-gray-600">Email</span>
          <span className="text-sm text-gray-900">{email ?? '–'}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm font-medium text-gray-600">Plan</span>
          <span className="text-sm font-semibold text-[#FB5B1E]">{plan}</span>
        </div>
      </div>

      <div className="mt-6 bg-[#FB5B1E]/10 border-2 border-[#FB5B1E] rounded p-5">
        <p className="font-semibold text-sm mb-1">Upgrade to Pro</p>
        <p className="text-xs text-gray-600 mb-3">
          Unlimited drafts, priority support, Google Calendar sync, and advanced voice learning.
        </p>
        <a href="/pricing" className="inline-block text-sm font-semibold text-white bg-[#FB5B1E] border-2 border-black rounded px-4 py-2 shadow-[3px_3px_0_black] hover:shadow-[1px_1px_0_black] hover:translate-x-0.5 hover:translate-y-0.5 transition-all">
          See plans
        </a>
      </div>

      <div className="mt-10 pt-6 border-t-2 border-black">
        <button
          onClick={handleSignOut}
          className="text-sm font-medium text-red-600 hover:text-red-800 underline"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
