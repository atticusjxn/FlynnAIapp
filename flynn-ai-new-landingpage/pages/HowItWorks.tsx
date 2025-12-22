import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Download, Link as LinkIcon, Settings, CheckCircle } from 'lucide-react';
import StoreButtons from '../components/StoreButtons';

const HowItWorks: React.FC = () => {
    return (
        <>
            <Helmet>
                <title>How It Works - Flynn AI | Setup in 3 Minutes</title>
                <meta name="description" content="See how Flynn AI works. Download the app, connect your phone number, and start capturing missed calls in minutes. Watch the video demo." />
            </Helmet>

            <div className="bg-white min-h-screen">
                {/* Hero Section */}
                <header className="pt-20 pb-16 px-6 max-w-7xl mx-auto text-center">
                    <h1 className="text-6xl md:text-8xl font-bold font-display text-black mb-8 tracking-tighter">
                        It's almost too <br />
                        <span className="text-brand-500">simple.</span>
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto font-medium mb-12">
                        You don't need IT. You don't need complex hardware. You just need your phone.
                    </p>
                </header>

                {/* Video Demo Section */}
                <section className="pb-24 px-6">
                    <div className="max-w-5xl mx-auto">
                        <div className="relative aspect-video bg-black rounded-3xl overflow-hidden shadow-[12px_12px_0px_0px_#000000] border-4 border-black group">
                            <video
                                className="w-full h-full object-cover"
                                controls
                                poster="https://Placehold.co/1920x1080/000000/FFFFFF/png?text=Flynn+AI+Demo"
                            >
                                <source src="/demo-video.mp4" type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    </div>
                </section>

                {/* 3 Step Process */}
                <section className="py-24 bg-surface-50 border-y-2 border-black">
                    <div className="max-w-7xl mx-auto px-6">
                        <h2 className="text-4xl font-bold font-display text-center mb-20 uppercase tracking-widest">The Setup</h2>

                        <div className="grid md:grid-cols-3 gap-12 relative">
                            {/* Connector Line (Desktop) */}
                            <div className="hidden md:block absolute top-12 left-0 right-0 h-1 bg-black -z-10 transform translate-y-1/2"></div>

                            {/* Step 1 */}
                            <div className="bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[12px_12px_0px_0px_rgba(255,69,0,1)] transition-all relative flex flex-col items-center">
                                <div className="w-24 h-24 bg-brand-500 rounded-full flex items-center justify-center border-4 border-black absolute -top-12 left-1/2 transform -translate-x-1/2">
                                    <Download className="w-10 h-10 text-white" />
                                </div>
                                <div className="mt-12 text-center w-full">
                                    <h3 className="text-2xl font-bold font-display mb-4">1. Download App</h3>
                                    <p className="text-gray-600 mb-6">Available on iOS and Android. Create your account in seconds.</p>
                                    <div className="scale-75 origin-top">
                                        <StoreButtons />
                                    </div>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[12px_12px_0px_0px_rgba(255,69,0,1)] transition-all relative">
                                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center border-4 border-black absolute -top-12 left-1/2 transform -translate-x-1/2">
                                    <LinkIcon className="w-10 h-10 text-black" />
                                </div>
                                <div className="mt-12 text-center">
                                    <h3 className="text-2xl font-bold font-display mb-4">2. Connect Number</h3>
                                    <p className="text-gray-600">Enable call forwarding with a simple dial code. We guide you through it.</p>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="bg-white p-8 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] hover:shadow-[12px_12px_0px_0px_rgba(255,69,0,1)] transition-all relative">
                                <div className="w-24 h-24 bg-black rounded-full flex items-center justify-center border-4 border-black absolute -top-12 left-1/2 transform -translate-x-1/2">
                                    <Settings className="w-10 h-10 text-white" />
                                </div>
                                <div className="mt-12 text-center">
                                    <h3 className="text-2xl font-bold font-display mb-4">3. Configure AI</h3>
                                    <p className="text-gray-600">Tell Flynn your business name, pricing, and services. He learns instantly.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Detailed Features / What it handles */}
                <section className="py-24 px-6 max-w-7xl mx-auto">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-4xl md:text-5xl font-bold font-display mb-8">What happens when Flynn answers?</h2>
                            <div className="space-y-6">
                                {[
                                    "Greets the customer professionally with your business name.",
                                    "Answers questions about your services and pricing.",
                                    "Collects customer details (Name, Address, Issue).",
                                    "Schedule appointments directly into your calendar.",
                                    "Sends you a summary and recording immediately.",
                                    "Filters out spam calls automatically."
                                ].map((feature, i) => (
                                    <div key={i} className="flex items-start gap-4">
                                        <CheckCircle className="w-6 h-6 text-brand-500 shrink-0 mt-1" />
                                        <p className="text-xl font-medium">{feature}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="relative">
                            {/* Placeholder for Screenshot */}
                            <div className="aspect-[9/16] bg-gray-100 border-4 border-black rounded-[3rem] shadow-[20px_20px_0px_0px_#000000] overflow-hidden relative">
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                                    <p className="font-display font-bold text-gray-400 text-xl">App Interface Screenshot</p>
                                </div>
                                <div className="absolute top-0 w-full h-8 bg-black/10 backdrop-blur-md z-10"></div>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-black rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="py-32 bg-black text-white text-center">
                    <h2 className="text-4xl md:text-6xl font-bold font-display mb-8">Ready to automate?</h2>
                    <button className="bg-brand-500 text-white px-12 py-6 text-xl font-bold uppercase tracking-widest border-4 border-white shadow-[8px_8px_0px_0px_rgba(255,255,255,0.3)] transition-all hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]">
                        Get Started Free
                    </button>
                </section>
            </div>
        </>
    );
};

export default HowItWorks;
