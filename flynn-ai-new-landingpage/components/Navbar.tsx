import React, { useState, useEffect } from 'react';
import { Menu, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-surface-100/80 backdrop-blur-xl border-b border-black/5 py-2' : 'bg-transparent py-6'
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-2 group cursor-pointer">
            <div className="w-10 h-10 bg-brand-500 rounded-none flex items-center justify-center transform transition-transform group-hover:rotate-12 duration-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <Zap className="w-6 h-6 text-white" fill="currentColor" />
            </div>
            <span className="font-display font-bold text-2xl text-black tracking-tighter group-hover:tracking-normal transition-all duration-500">
              Flynn<span className="text-brand-500">.ai</span>
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-8">
              <div className="ml-10 flex items-center space-x-8">
                <Link to="/" className="text-black hover:text-brand-500 transition-colors text-sm font-medium font-display tracking-wide uppercase">Home</Link>
                <Link to="/features" className="text-black hover:text-brand-500 transition-colors text-sm font-medium font-display tracking-wide uppercase">Features</Link>
                <Link to="/pricing" className="text-black hover:text-brand-500 transition-colors text-sm font-medium font-display tracking-wide uppercase">Pricing</Link>
                <Link to="/how-it-works" className="text-black hover:text-brand-500 transition-colors text-sm font-medium font-display tracking-wide uppercase">How it Works</Link>
                <Link to="/sites" className="text-black hover:text-brand-500 transition-colors text-sm font-medium font-display tracking-wide uppercase">Websites (New)</Link>
                <button className="bg-black text-white px-6 py-3 text-sm font-bold font-display uppercase hover:bg-brand-500 transition-all shadow-[4px_4px_0px_0px_rgba(100,100,100,0.2)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]">
                  Get Started
                </button>
              </div>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-black p-2"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-black/10 overflow-hidden absolute w-full"
          >
            <div className="px-4 pt-4 pb-8 space-y-4">
              <Link to="/features" className="text-black block text-3xl font-display font-bold hover:text-brand-500" onClick={() => setMobileMenuOpen(false)}>Features</Link>
              <Link to="/how-it-works" className="text-black block text-3xl font-display font-bold hover:text-brand-500" onClick={() => setMobileMenuOpen(false)}>How it Works</Link>
              <Link to="/pricing" className="text-black block text-3xl font-display font-bold hover:text-brand-500" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
              <Link to="/sites" className="text-black block text-3xl font-display font-bold hover:text-brand-500" onClick={() => setMobileMenuOpen(false)}>Websites (New)</Link>
              <button className="w-full text-center mt-8 bg-brand-500 text-white px-5 py-4 font-bold text-xl font-display uppercase">
                Get Started
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;