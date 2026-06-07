import React from 'react';
import { Link, useParams, Outlet } from 'react-router-dom';
import BusinessBrainSection from '../pages/app/sections/BusinessBrainSection';
import VoiceToneSection from '../pages/app/sections/VoiceToneSection';
import CalendarSection from '../pages/app/sections/CalendarSection';
import AccountSection from '../pages/app/sections/AccountSection';
import LearnedSection from '../pages/app/sections/LearnedSection';

const SECTIONS = [
  { key: 'business-brain', label: 'Business Brain', icon: '🧠' },
  { key: 'voice-tone',     label: 'Voice & Tone',   icon: '🎙️' },
  { key: 'calendar',       label: 'Calendar',        icon: '📅' },
  { key: 'account',        label: 'Account',         icon: '👤' },
  { key: 'learned',        label: 'What I Learned',  icon: '📖' },
];

const SECTION_COMPONENTS: Record<string, React.FC> = {
  'business-brain': BusinessBrainSection,
  'voice-tone':     VoiceToneSection,
  'calendar':       CalendarSection,
  'account':        AccountSection,
  'learned':        LearnedSection,
};

export default function AppLayout() {
  const { section = 'business-brain' } = useParams<{ section: string }>();
  const SectionComponent = SECTION_COMPONENTS[section] ?? BusinessBrainSection;

  return (
    <div className="min-h-screen bg-[#F4E6CE] flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r-2 border-black flex flex-col">
        <div className="px-5 py-6 border-b-2 border-black">
          <span className="font-bold text-lg tracking-tight">Flynn</span>
          <p className="text-xs text-gray-500 mt-0.5">Settings & Context</p>
        </div>
        <nav className="flex flex-col p-3 gap-1 flex-1">
          {SECTIONS.map((s) => {
            const active = s.key === section;
            return (
              <Link
                key={s.key}
                to={`/app/settings/${s.key}`}
                className={[
                  'flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium transition-colors',
                  active
                    ? 'bg-[#FB5B1E] text-white'
                    : 'text-gray-700 hover:bg-[#F4E6CE]',
                ].join(' ')}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t-2 border-black">
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Changes save automatically. Context is used in your next draft.
          </p>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-10">
          <SectionComponent />
        </div>
      </main>
    </div>
  );
}
