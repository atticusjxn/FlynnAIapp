import React from 'react';
import PricingTable from './PricingTable';

const Pricing: React.FC = () => {
  return (
    <section id="pricing" className="py-32 bg-white border-t-2 border-black relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-5xl md:text-7xl font-bold text-black font-display tracking-tight mb-6">
            Pricing that <br />makes sense.
          </h2>
          <p className="text-xl text-gray-500">No contracts. No setup fees. Just results.</p>
        </div>

        <PricingTable />
      </div>
    </section>
  );
};

export default Pricing;