import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const NAV: { to: string; label: string }[] = [
  { to: '/', label: 'Today' },
  { to: '/queue/cold-email', label: 'Cold email' },
  { to: '/queue/ig-dms', label: 'IG DMs' },
  { to: '/queue/fb-groups', label: 'FB groups' },
  { to: '/leads', label: 'Leads' },
  { to: '/metrics', label: 'Metrics' },
  { to: '/settings', label: 'Settings' },
];

export function Layout() {
  const { signOut, email } = useAuth();
  return (
    <div className="flex h-screen">
      <aside className="flex w-56 flex-none flex-col border-r border-border bg-panel">
        <div className="px-5 pb-3 pt-5">
          <div className="text-base font-semibold tracking-tight">Flynn GTM</div>
          <div className="text-xs text-muted">{email}</div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border px-3 py-3">
          <button onClick={signOut} className="btn-ghost w-full justify-start">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
