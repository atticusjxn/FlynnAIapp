import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import PricingTable from '../components/PricingTable';

const PricingPage: React.FC = () => {
    const [avgJobValue, setAvgJobValue] = useState(350);
    const [missedCalls, setMissedCalls] = useState(5);

    const annualLoss = avgJobValue * missedCalls * 52;

    return (
        <>
            <Helmet>
                <title>Pricing - Flynn AI | Transparent Plans for Service Businesses</title>
                <meta name="description" content="Simple pricing for your AI receptionist. 24/7 call handling starting at $29/mo. Calculate your ROI and see how much missed calls are costing you." />
            </Helmet>

            <div className="bg-white min-h-screen">
                {/* Header */}
                <header className="pt-20 pb-20 px-6 max-w-7xl mx-auto text-center">
                    <h1 className="text-6xl md:text-8xl font-bold font-display text-black mb-6 tracking-tighter">
                        Pricing that pays<br />
                        <span className="text-brand-500">for itself.</span>
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto font-medium">
                        Start with a 14-day free trial. No credit card required. Cancel anytime.
                    </p>
                </header>

                {/* ROI Calculator */}
                <section className="py-20 bg-surface-50 border-y-2 border-black">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="grid md:grid-cols-2 gap-16 items-center">
                            <div>
                                <h2 className="text-4xl font-bold font-display mb-6">Are missed calls eating your profit?</h2>
                                <p className="text-lg text-gray-600 mb-8">
                                    78% of customers go to the first business that picks up. If you're missing calls, you're handing money to your competitors.
                                </p>

                                <div className="space-y-8">
                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="font-bold font-display">Average Job Value</label>
                                            <span className="font-bold text-brand-500">${avgJobValue}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="50"
                                            max="2000"
                                            step="50"
                                            value={avgJobValue}
                                            onChange={(e) => setAvgJobValue(Number(e.target.value))}
                                            className="w-full accent-brand-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex justify-between mb-2">
                                            <label className="font-bold font-display">Missed Calls Per Week</label>
                                            <span className="font-bold text-brand-500">{missedCalls}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="50"
                                            step="1"
                                            value={missedCalls}
                                            onChange={(e) => setMissedCalls(Number(e.target.value))}
                                            className="w-full accent-brand-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-black text-white p-10 shadow-[8px_8px_0px_0px_#ff4500]">
                                <h3 className="text-xl font-bold font-display uppercase tracking-widest text-gray-400 mb-2">Annual Revenue Lost</h3>
                                <div className="text-6xl md:text-7xl font-bold font-display text-brand-500 mb-4">
                                    ${annualLoss.toLocaleString()}
                                </div>
                                <p className="text-gray-300 mb-8">
                                    That's potential revenue slipping through your fingers. Flynn captures these leads instantly.
                                </p>
                                <button className="w-full bg-white text-black font-bold py-4 px-6 uppercase tracking-wider hover:bg-brand-500 hover:text-white transition-colors">
                                    Stop Losing Money
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Pricing Table Section */}
                <section className="py-24">
                    <div className="max-w-7xl mx-auto px-6">
                        <PricingTable />
                    </div>
                </section>

                {/* FAQ or Additional Info could go here */}
            </div>
        </>
    );
};

export default PricingPage;
