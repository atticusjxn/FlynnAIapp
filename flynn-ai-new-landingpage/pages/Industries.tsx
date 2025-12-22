import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Wrench, Zap, Droplets, Thermometer, ArrowRight, CheckCircle } from 'lucide-react';
import plumberPhone from '../assets/plumber-phone.png';
import electricianPhone from '../assets/electrician-phone.png';
import hvacPhone from '../assets/hvac-phone.png';
import cleanerPhone from '../assets/cleaner-phone.png';

const industriesData: Record<string, { title: string; icon: any; description: string; benefits: string[]; seoTitle: string; image: string }> = {
    plumbers: {
        title: "Plumbers",
        icon: Droplets,
        description: "Stop missing emergency calls while you're under a sink. Flynn routes urgent jobs instantly.",
        benefits: ["Filter emergency calls vs routine jobs", "Quote heater replacements automatically", "Dispatch jobs to subcontractors"],
        seoTitle: "AI Receptionist for Plumbers | Flynn AI",
        image: plumberPhone
    },
    electricians: {
        title: "Electricians",
        icon: Zap,
        description: "You're paid for wiring, not answering phones. Let Flynn handle the intake.",
        benefits: ["Qualify leads (residential vs commercial)", "Book site inspections instantly", "Send safety certificates automatically"],
        seoTitle: "AI Receptionist for Electricians | Flynn AI",
        image: electricianPhone
    },
    hvac: {
        title: "HVAC",
        icon: Thermometer,
        description: "Peak season volume? No problem. Flynn scales infinitely to handle the heat.",
        benefits: ["Handle seasonal call spikes easily", "Troubleshoot simple issues via AI", "Schedule maintenance reminders"],
        seoTitle: "AI Receptionist for HVAC Businesses | Flynn AI",
        image: hvacPhone
    },
    cleaners: {
        title: "Cleaners",
        icon: Wrench, // Using generic tool for now or maybe sparkle if available
        description: "Fill your schedule and manage recurring bookings without the back-and-forth.",
        benefits: ["Manage recurring booking changes", "Send booking reminders", "Handle cancellation fees"],
        seoTitle: "AI Receptionist for Cleaning Businesses | Flynn AI",
        image: cleanerPhone
    }
};

export const IndustriesList: React.FC = () => {
    return (
        <>
            <Helmet>
                <title>Industries - Flynn AI | Tailored for Trades</title>
                <meta name="description" content="Flynn AI is trained for your specific trade. Plumbers, Electricians, HVAC, and more. See how we help your business." />
            </Helmet>
            <div className="bg-white min-h-screen pt-20 pb-20 px-6">
                <div className="max-w-7xl mx-auto text-center mb-16">
                    <h1 className="text-6xl md:text-8xl font-bold font-display text-black mb-6 tracking-tighter">
                        Built for <br /><span className="text-brand-500">Service</span>
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto font-medium">
                        Flynn isn't a generic chatbot. He's trained on thousands of real service calls.
                    </p>
                </div>

                <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Object.entries(industriesData).map(([slug, data]) => (
                        <Link key={slug} to={`/industries/${slug}`} className="group block bg-surface-50 border-2 border-transparent hover:border-black p-8 transition-all hover:shadow-[8px_8px_0px_0px_#000000]">
                            <div className="w-16 h-16 bg-brand-500 text-white flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_#000000] group-hover:translate-x-1 group-hover:translate-y-1 transition-transform">
                                <data.icon size={32} />
                            </div>
                            <h2 className="text-2xl font-bold font-display mb-2 text-black">{data.title}</h2>
                            <p className="text-gray-600 mb-6 text-sm">{data.description}</p>
                            <div className="flex items-center text-brand-500 font-bold uppercase tracking-wider text-sm">
                                View Use Case <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </>
    );
}

export const IndustryDetail: React.FC = () => {
    const { type } = useParams<{ type: string }>();
    const industry = industriesData[type?.toLowerCase() || ""];

    if (!industry) {
        return <Navigate to="/industries" replace />;
    }

    const Icon = industry.icon;

    return (
        <>
            <Helmet>
                <title>{industry.seoTitle}</title>
                <meta name="description" content={industry.description} />
            </Helmet>

            <div className="bg-white min-h-screen">
                <header className="pt-20 pb-20 px-6 max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row gap-12 items-center">
                        <div className="flex-1">
                            <div className="inline-flex items-center gap-2 bg-surface-100 px-4 py-2 rounded-full mb-6 text-sm font-bold uppercase tracking-wider">
                                <Icon size={16} className="text-brand-500" />
                                <span>For {industry.title}</span>
                            </div>
                            <h1 className="text-5xl md:text-7xl font-bold font-display text-black mb-6 tracking-tighter">
                                The Receptionist for <br /><span className="text-brand-500">{industry.title}.</span>
                            </h1>
                            <p className="text-xl text-gray-600 font-medium mb-8">
                                {industry.description}
                            </p>
                            <Link to="/how-it-works" className="bg-black text-white px-8 py-4 font-bold uppercase tracking-wider hover:bg-brand-500 hover:scale-105 transition-all inline-block">
                                See a Demo
                            </Link>
                        </div>
                        <div className="flex-1 w-full relative">
                            <div className="aspect-square bg-gray-100 border-4 border-black shadow-[16px_16px_0px_0px_#ff4500] overflow-hidden">
                                <img
                                    src={industry.image}
                                    alt={`${industry.title} pro using Flynn AI`}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>
                    </div>
                </header>

                <section className="py-24 bg-surface-50">
                    <div className="max-w-7xl mx-auto px-6">
                        <h2 className="text-3xl font-bold font-display mb-12">Why {industry.title} choose Flynn</h2>
                        <div className="grid md:grid-cols-3 gap-8">
                            {industry.benefits.map((benefit, i) => (
                                <div key={i} className="bg-white p-8 border-2 border-black">
                                    <CheckCircle className="w-8 h-8 text-brand-500 mb-4" />
                                    <h3 className="text-xl font-bold font-display">{benefit}</h3>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
};
