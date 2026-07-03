import React from 'react';
import { Link } from 'react-router-dom';

const APP_STORE = 'https://apps.apple.com/au/app/flynnai/id6752254950';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.flynnai.app';

const col = (title: string, items: { label: string; href: string; external?: boolean }[]) => (
  <div>
    <h4 className="font-display font-bold uppercase tracking-wider mb-5 text-[#2C2018] text-sm">{title}</h4>
    <ul className="space-y-3 text-[15px] text-[#5A4A3C] font-medium">
      {items.map(i => (
        <li key={i.label}>
          {i.external
            ? <a href={i.href} target="_blank" rel="noopener noreferrer" className="hover:text-[#FB5B1E] transition-colors">{i.label}</a>
            : i.href.startsWith('/#')
              ? <a href={i.href} className="hover:text-[#FB5B1E] transition-colors">{i.label}</a>
              : <Link to={i.href} className="hover:text-[#FB5B1E] transition-colors">{i.label}</Link>}
        </li>
      ))}
    </ul>
  </div>
);

const Footer: React.FC = () => (
  <footer className="bg-[#FFFBF4] border-t-[3px] border-[#2C2018] pt-16 pb-10">
    <div className="max-w-7xl mx-auto px-5 sm:px-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <img src="/mascots/mark.png" alt="Flynn" className="w-9 h-9" />
            <span className="font-display font-bold text-2xl text-[#2C2018]">Flynn</span>
          </div>
          <p className="text-[#5A4A3C] text-[15px] leading-relaxed font-medium max-w-xs">
            Reply in your voice. Lock in the time. The keyboard that drafts your texts and books the job, right inside Messages.
          </p>
        </div>
        {col('Product', [
          { label: 'How it works', href: '/#how' },
          { label: 'Features', href: '/#features' },
          { label: 'Pricing', href: '/#pricing' },
          { label: 'FAQ', href: '/#faq' },
        ])}
        {col('Company', [
          { label: 'Contact', href: '/contact' },
          { label: 'Privacy', href: '/privacy' },
          { label: 'Account deletion', href: '/delete-account' },
        ])}
        {col('Get the app', [
          { label: 'iOS · App Store', href: APP_STORE, external: true },
          { label: 'Android · Google Play', href: PLAY_STORE, external: true },
        ])}
      </div>
      <div className="border-t-2 border-[#2C2018]/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-3">
        <p className="text-[#8C7B6A] text-sm font-medium">© {new Date().getFullYear()} Mates Rates Services Pty Ltd. All rights reserved.</p>
        <p className="text-[#8C7B6A] text-sm font-medium">Flynn is a product of Mates Rates Services Pty Ltd.</p>
      </div>
    </div>
  </footer>
);

export default Footer;
