import React from 'react';
import { Zap, Instagram, Twitter, Linkedin } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t-2 border-black pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
               <div className="w-8 h-8 bg-brand-500 flex items-center justify-center shadow-[3px_3px_0px_0px_#000000]">
                <Zap className="w-5 h-5 text-white" fill="currentColor" />
              </div>
              <span className="font-display font-bold text-2xl text-black">Flynn.ai</span>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed font-medium max-w-xs">
              The AI receptionist for service businesses. We are building the future of blue-collar work automation.
            </p>
          </div>
          
          <div>
            <h4 className="text-black font-display font-bold uppercase tracking-wider mb-6">Product</h4>
            <ul className="space-y-3 text-sm text-gray-500 font-medium">
              <li><a href="#" className="hover:text-brand-500 transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-brand-500 transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-brand-500 transition-colors">Case Studies</a></li>
              <li><a href="#" className="hover:text-brand-500 transition-colors">Live Demo</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-black font-display font-bold uppercase tracking-wider mb-6">Company</h4>
            <ul className="space-y-3 text-sm text-gray-500 font-medium">
              <li><a href="#" className="hover:text-brand-500 transition-colors">About</a></li>
              <li><a href="#" className="hover:text-brand-500 transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-brand-500 transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-brand-500 transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-black font-display font-bold uppercase tracking-wider mb-6">Legal</h4>
            <ul className="space-y-3 text-sm text-gray-500 font-medium">
              <li><a href="#" className="hover:text-brand-500 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-brand-500 transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-400 text-sm font-medium">© {new Date().getFullYear()} Flynn AI. All rights reserved.</p>
          <div className="flex space-x-6">
            <a href="#" className="text-black hover:text-brand-500 transition-colors transform hover:-translate-y-1"><Twitter size={20} /></a>
            <a href="#" className="text-black hover:text-brand-500 transition-colors transform hover:-translate-y-1"><Instagram size={20} /></a>
            <a href="#" className="text-black hover:text-brand-500 transition-colors transform hover:-translate-y-1"><Linkedin size={20} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;