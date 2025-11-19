import React from 'react';
import { Check, X } from 'lucide-react';

const Pricing: React.FC = () => {
  return (
    <section id="pricing" className="py-32 bg-white border-t-2 border-black relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-5xl md:text-7xl font-bold text-black font-display tracking-tight mb-6">
            Pricing that <br/>makes sense.
          </h2>
          <p className="text-xl text-gray-500">No contracts. No setup fees. Just results.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="text-left py-8 px-6 w-1/4 font-display font-bold text-2xl">Plans</th>
                <th className="py-8 px-6 w-1/4 text-center bg-surface-50">
                  <span className="block text-2xl font-bold font-display">Solo</span>
                  <span className="text-gray-500 font-normal text-sm">$29/mo</span>
                </th>
                <th className="py-8 px-6 w-1/4 text-center bg-black text-white relative">
                   <div className="absolute top-0 left-0 right-0 bg-brand-500 text-white text-[10px] font-bold uppercase tracking-widest py-1">Best Value</div>
                  <span className="block text-2xl font-bold font-display mt-2">Pro</span>
                  <span className="text-gray-400 font-normal text-sm">$79/mo</span>
                </th>
                <th className="py-8 px-6 w-1/4 text-center bg-surface-50">
                  <span className="block text-2xl font-bold font-display">Team</span>
                  <span className="text-gray-500 font-normal text-sm">$149/mo</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                { feat: "Call Minutes", a: "50", b: "200", c: "500" },
                { feat: "Users", a: "1", b: "3", c: "Unlimited" },
                { feat: "SMS Summaries", a: true, b: true, c: true },
                { feat: "Custom Greeting", a: false, b: true, c: true },
                { feat: "CRM Integration", a: false, b: true, c: true },
                { feat: "Priority Support", a: false, b: false, c: true },
              ].map((row, i) => (
                <tr key={i} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                  <td className="py-6 px-6 font-medium text-black">{row.feat}</td>
                  <td className="py-6 px-6 text-center bg-surface-50/50">
                    {typeof row.a === 'boolean' ? (row.a ? <Check size={20} className="mx-auto text-brand-500" /> : <X size={20} className="mx-auto text-gray-300" />) : row.a}
                  </td>
                  <td className="py-6 px-6 text-center bg-surface-50">
                    {typeof row.b === 'boolean' ? (row.b ? <Check size={20} className="mx-auto text-black" /> : <X size={20} className="mx-auto text-gray-300" />) : <span className="font-bold">{row.b}</span>}
                  </td>
                  <td className="py-6 px-6 text-center bg-surface-50/50">
                    {typeof row.c === 'boolean' ? (row.c ? <Check size={20} className="mx-auto text-brand-500" /> : <X size={20} className="mx-auto text-gray-300" />) : row.c}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-8 px-6"></td>
                <td className="py-8 px-6 text-center">
                  <button className="w-full py-3 border-2 border-black font-bold hover:bg-black hover:text-white transition-all">Choose Solo</button>
                </td>
                <td className="py-8 px-6 text-center bg-surface-50">
                  <button className="w-full py-3 bg-brand-500 text-white font-bold shadow-[4px_4px_0px_0px_#000000] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0px_0px_#000000] transition-all">Choose Pro</button>
                </td>
                <td className="py-8 px-6 text-center">
                   <button className="w-full py-3 border-2 border-black font-bold hover:bg-black hover:text-white transition-all">Choose Team</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default Pricing;