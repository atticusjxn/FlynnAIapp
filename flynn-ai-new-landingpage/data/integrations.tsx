import React from 'react';

/**
 * The integration catalogue — Flynn's capability store.
 *
 * Flynn is a general-purpose text agent. Integrations ARE the product: each one
 * the user connects unlocks a new thing Flynn can do for them, whatever their
 * trade. Value lines are written around *capabilities*, kept vertical-agnostic.
 *
 * `provider`    — matches the DB enum in integration_connections.provider
 * `connectSlug` — the URL slug for the server connect endpoint
 *                 (/api/integrations/<connectSlug>/connect). Hyphenated.
 * `available`   — whether the OAuth/connect backend is live yet. When false the
 *                 card renders as "Coming soon" so the grid never offers a
 *                 broken Connect button.
 */

export type AuthType = 'oauth' | 'eventkit' | 'credentials';

export interface IntegrationMeta {
  provider: string;
  connectSlug: string;
  name: string;
  category: string;
  value: string;
  authType: AuthType;
  available: boolean;
  note?: string;
  accent: string;
  Icon: React.FC<{ className?: string }>;
}

// ─── Brand marks (inline SVG, scale cleanly on every surface) ────────────────

const GoogleCalendarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <rect x="11" y="11" width="26" height="26" rx="3" fill="#fff" stroke="#dadce0" />
    <path d="M11 14a3 3 0 0 1 3-3h20a3 3 0 0 1 3 3v4H11z" fill="#4285F4" />
    <path d="M11 30h26v4a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3z" fill="#188038" />
    <rect x="33" y="18" width="4" height="12" fill="#FBBC04" />
    <rect x="11" y="18" width="4" height="12" fill="#1967D2" />
    <text x="24" y="29" fontSize="11" fontWeight="700" fill="#4285F4" textAnchor="middle" fontFamily="Arial">31</text>
  </svg>
);

const AppleCalendarIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <rect x="9" y="9" width="30" height="30" rx="7" fill="#fff" stroke="#e5e5e5" />
    <text x="24" y="22" fontSize="8" fontWeight="700" fill="#FF3B30" textAnchor="middle" fontFamily="Arial">SUN</text>
    <text x="24" y="36" fontSize="15" fontWeight="700" fill="#1d1d1f" textAnchor="middle" fontFamily="Arial">14</text>
  </svg>
);

const GmailIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <rect x="8" y="13" width="32" height="22" rx="3" fill="#fff" stroke="#e0e0e0" />
    <path d="M8 16l16 11L40 16" fill="none" stroke="#EA4335" strokeWidth="3" />
    <path d="M8 16v-1a2 2 0 0 1 2-2h2l12 9 12-9h2a2 2 0 0 1 2 2v1" fill="#EA4335" opacity="0.15" />
  </svg>
);

const XeroIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <circle cx="24" cy="24" r="16" fill="#13B5EA" />
    <path d="M19 19l10 10M29 19L19 29" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const MyobIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <rect x="8" y="8" width="32" height="32" rx="8" fill="#6100A5" />
    <text x="24" y="29" fontSize="11" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="Arial">MYOB</text>
  </svg>
);

const QuickBooksIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <circle cx="24" cy="24" r="16" fill="#2CA01C" />
    <text x="24" y="30" fontSize="16" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="Arial">qb</text>
  </svg>
);

const StripeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <rect x="8" y="8" width="32" height="32" rx="8" fill="#635BFF" />
    <text x="24" y="30" fontSize="18" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="Arial">S</text>
  </svg>
);

const JobberIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <rect x="8" y="8" width="32" height="32" rx="8" fill="#1F7A54" />
    <text x="24" y="30" fontSize="18" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="Arial">J</text>
  </svg>
);

const ServiceM8Icon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <rect x="8" y="8" width="32" height="32" rx="8" fill="#FF6900" />
    <text x="24" y="30" fontSize="13" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="Arial">M8</text>
  </svg>
);

const InstagramIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <defs>
      <radialGradient id="ig" cx="0.3" cy="1" r="1">
        <stop offset="0" stopColor="#FFD600" />
        <stop offset="0.5" stopColor="#FF0100" />
        <stop offset="1" stopColor="#D800B9" />
      </radialGradient>
    </defs>
    <rect x="8" y="8" width="32" height="32" rx="9" fill="url(#ig)" />
    <rect x="15" y="15" width="18" height="18" rx="6" fill="none" stroke="#fff" strokeWidth="2.4" />
    <circle cx="24" cy="24" r="5" fill="none" stroke="#fff" strokeWidth="2.4" />
    <circle cx="31" cy="17" r="1.6" fill="#fff" />
  </svg>
);

const DriveIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <path d="M18 9h12l12 21H30z" fill="#FFCF63" />
    <path d="M6 30L18 9l6 10.5L12 40z" fill="#11A861" />
    <path d="M12 40l6-10.5h24L36 40z" fill="#3777E3" />
  </svg>
);

const DropboxIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <path d="M16 11l-8 5 8 5 8-5z" fill="#0061FF" />
    <path d="M32 11l8 5-8 5-8-5z" fill="#0061FF" />
    <path d="M8 26l8 5 8-5-8-5z" fill="#0061FF" />
    <path d="M40 26l-8 5-8-5 8-5z" fill="#0061FF" />
    <path d="M16 33l8 5 8-5-8-5z" fill="#0061FF" opacity="0.85" />
  </svg>
);

const ReeceIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <rect x="8" y="8" width="32" height="32" rx="8" fill="#003DA5" />
    <text x="24" y="30" fontSize="18" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="Arial">R</text>
  </svg>
);

const TradelinkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <rect x="8" y="8" width="32" height="32" rx="8" fill="#E2231A" />
    <text x="24" y="30" fontSize="18" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="Arial">T</text>
  </svg>
);

// ─── Catalogue ───────────────────────────────────────────────────────────────
// Ordered by category. `available` flips on as each backend lands.

export const INTEGRATIONS: IntegrationMeta[] = [
  // Calendar & scheduling
  {
    provider: 'google_calendar', connectSlug: 'google-calendar', name: 'Google Calendar',
    category: 'Calendar & scheduling', value: 'Book jobs and check your real availability',
    authType: 'oauth', available: true, accent: '#4285F4', Icon: GoogleCalendarIcon,
  },
  {
    provider: 'apple_calendar', connectSlug: 'apple-calendar', name: 'Apple Calendar',
    category: 'Calendar & scheduling', value: 'Same booking + availability for Apple users',
    authType: 'credentials', available: true, note: 'Connect with an iCloud app-specific password',
    accent: '#FF3B30', Icon: AppleCalendarIcon,
  },

  // Email & messaging
  {
    provider: 'gmail', connectSlug: 'gmail', name: 'Gmail',
    category: 'Email & messaging', value: 'Draft email replies and flag new leads',
    authType: 'oauth', available: false, accent: '#EA4335', Icon: GmailIcon,
  },

  // Invoicing & payments
  {
    provider: 'xero', connectSlug: 'xero', name: 'Xero',
    category: 'Invoicing & payments', value: 'Send invoices and file the receipts you snap',
    authType: 'oauth', available: true, accent: '#13B5EA', Icon: XeroIcon,
  },
  {
    provider: 'myob', connectSlug: 'myob', name: 'MYOB',
    category: 'Invoicing & payments', value: 'Invoicing and receipts (AU/NZ)',
    authType: 'oauth', available: false, accent: '#6100A5', Icon: MyobIcon,
  },
  {
    provider: 'quickbooks', connectSlug: 'quickbooks', name: 'QuickBooks',
    category: 'Invoicing & payments', value: 'Invoicing and bookkeeping',
    authType: 'oauth', available: false, accent: '#2CA01C', Icon: QuickBooksIcon,
  },
  {
    provider: 'stripe', connectSlug: 'stripe', name: 'Stripe',
    category: 'Invoicing & payments', value: 'Send a payment link in a tap',
    authType: 'oauth', available: false, accent: '#635BFF', Icon: StripeIcon,
  },

  // Job & client management
  {
    provider: 'jobber', connectSlug: 'jobber', name: 'Jobber',
    category: 'Job & client management', value: 'Sync jobs and clients both ways',
    authType: 'oauth', available: true, accent: '#1F7A54', Icon: JobberIcon,
  },
  {
    provider: 'servicem8', connectSlug: 'servicem8', name: 'ServiceM8',
    category: 'Job & client management', value: 'Sync jobs (AU field service)',
    authType: 'oauth', available: false, accent: '#FF6900', Icon: ServiceM8Icon,
  },

  // Files & storage
  {
    provider: 'google_drive', connectSlug: 'google-drive', name: 'Google Drive',
    category: 'Files & storage', value: 'Store quotes, receipts and job docs',
    authType: 'oauth', available: false, accent: '#11A861', Icon: DriveIcon,
  },
  {
    provider: 'dropbox', connectSlug: 'dropbox', name: 'Dropbox',
    category: 'Files & storage', value: 'Store and share job files',
    authType: 'oauth', available: false, accent: '#0061FF', Icon: DropboxIcon,
  },

  // Suppliers & ordering
  {
    provider: 'reece', connectSlug: 'reece', name: 'Reece',
    category: 'Suppliers & ordering', value: 'Order parts straight from a chat',
    authType: 'credentials', available: false, accent: '#003DA5', Icon: ReeceIcon,
  },
  {
    provider: 'tradelink', connectSlug: 'tradelink', name: 'Tradelink',
    category: 'Suppliers & ordering', value: 'Order parts and supplies',
    authType: 'credentials', available: false, accent: '#E2231A', Icon: TradelinkIcon,
  },

  // Marketing
  {
    provider: 'instagram', connectSlug: 'instagram', name: 'Instagram',
    category: 'Marketing', value: 'Turn job photos into posts',
    authType: 'oauth', available: false, accent: '#D800B9', Icon: InstagramIcon,
  },
];

// Display order for category groupings.
export const CATEGORY_ORDER: string[] = [
  'Calendar & scheduling',
  'Email & messaging',
  'Invoicing & payments',
  'Job & client management',
  'Files & storage',
  'Suppliers & ordering',
  'Marketing',
];

export const INTEGRATIONS_BY_PROVIDER: Record<string, IntegrationMeta> =
  Object.fromEntries(INTEGRATIONS.map((i) => [i.provider, i]));
