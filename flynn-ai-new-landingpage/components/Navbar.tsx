import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

const APP_STORE = 'https://apps.apple.com/au/app/flynnai/id6752254950';

const links = [
  { label: 'How it works', href: '/#how' },
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'FAQ', href: '/#faq' },
];

const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#F4E6CE]/85 backdrop-blur-xl border-b-2 border-[#2C2018] py-2' : 'bg-transparent py-5'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/mascots/mark.png" alt="Flynn" className="w-10 h-10 transition-transform group-hover:-rotate-6 duration-300" />
            <span className="font-display font-bold text-2xl text-[#2C2018] tracking-tight">Flynn</span>
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-8">
            {links.map(l => (
              <a key={l.href} href={l.href} className="text-[#2C2018] hover:text-[#FB5B1E] transition-colors text-sm font-semibold font-display tracking-wide">{l.label}</a>
            ))}
            <a href={APP_STORE} target="_blank" rel="noopener noreferrer"
              className="flynn-glass flynn-glass--primary flynn-pill text-white px-6 py-3 text-sm font-bold font-display inline-flex items-center">
              Get the app
            </a>
          </div>

          {/* Mobile button */}
          <button onClick={() => setMobileMenuOpen(o => !o)} className="md:hidden text-[#2C2018] p-2">
            {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#F4E6CE] border-b-2 border-[#2C2018] overflow-hidden absolute w-full">
            <div className="px-5 pt-4 pb-8 space-y-4">
              {links.map(l => (
                <a key={l.href} href={l.href} onClick={() => setMobileMenuOpen(false)}
                  className="block text-3xl font-display font-bold text-[#2C2018] hover:text-[#FB5B1E]">{l.label}</a>
              ))}
              <a href={APP_STORE} target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)}
                className="flynn-glass flynn-glass--primary flynn-pill block text-center mt-6 text-white px-5 py-4 font-bold text-xl font-display">
                Get the app
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
