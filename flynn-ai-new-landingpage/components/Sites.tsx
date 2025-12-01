import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import Navbar from './Navbar';
import Footer from './Footer';

const Sites = () => {
    const { scrollY } = useScroll();
    const y1 = useTransform(scrollY, [0, 1000], [0, 200]);
    const rotate = useTransform(scrollY, [0, 1000], [0, 10]);

    return (
        <div className="min-h-screen bg-[#f3f4f6] font-sans selection:bg-brand-500 selection:text-white overflow-hidden">
            <Navbar />

            {/* Hero Section */}
            <main className="relative pt-32 pb-32 lg:pt-48 overflow-hidden">
                {/* Background Shapes */}
                <motion.div style={{ y: y1, rotate }} className="absolute top-0 right-0 w-[800px] h-[800px] bg-white border-2 border-gray-200 rounded-full -z-10 opacity-50 translate-x-1/2 -translate-y-1/4"></motion.div>
                <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-brand-500/5 rounded-full blur-3xl -z-10"></div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl mx-auto text-center relative z-10">
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <div className="inline-block bg-black text-white px-4 py-1.5 text-sm font-bold uppercase tracking-widest mb-8 transform -rotate-2">
                                Flynn Sites — New
                            </div>

                            <h1 className="text-6xl lg:text-[6rem] leading-[0.9] font-bold text-black font-display mb-8 tracking-tighter">
                                Turn Your Instagram <br />
                                <span className="text-brand-500 italic">Into a Website.</span>
                            </h1>

                            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto font-medium leading-relaxed">
                                Paste your Instagram handle and Flynn builds a modern, SEO-ready website in seconds — with your photos, services, brand colors, and copy.
                            </p>

                            {/* Input Mockup */}
                            <div className="max-w-lg mx-auto bg-white p-2 border-4 border-black shadow-[8px_8px_0px_0px_#000000] flex gap-2 mb-12 transform hover:-translate-y-1 transition-transform duration-300">
                                <div className="flex-1 flex items-center px-4 bg-gray-50">
                                    <span className="text-gray-400 font-bold mr-1">@</span>
                                    <input
                                        type="text"
                                        placeholder="yourhandle"
                                        className="w-full bg-transparent border-none focus:ring-0 font-bold text-lg placeholder-gray-300"
                                        disabled
                                    />
                                </div>
                                <button className="bg-black text-white px-6 py-3 font-bold uppercase tracking-wide hover:bg-brand-500 transition-colors">
                                    Generate
                                </button>
                            </div>

                            <button className="bg-brand-500 text-white hover:bg-black hover:text-white px-10 py-5 text-lg font-bold uppercase tracking-widest border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px]">
                                Generate My Site
                            </button>
                        </motion.div>
                    </div>
                </div>
            </main>

            {/* How It Works Section */}
            <section className="py-32 bg-white border-t-2 border-black">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-20">
                        <h2 className="text-5xl font-bold text-black font-display uppercase">How Flynn Sites Works</h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-0 border-l-2 border-black">
                        {[
                            { step: "01", title: "Enter Your Instagram", desc: "Just paste your Instagram handle. No forms. No builders. No templates." },
                            { step: "02", title: "Flynn Generates", desc: "Flynn scans your style, services, photos, and brand voice to build a complete site." },
                            { step: "03", title: "Launch", desc: "Publish instantly or unlock advanced features inside Flynn." }
                        ].map((item, idx) => (
                            <div key={idx} className="group border-r-2 border-b-2 border-black p-10 hover:bg-brand-500 hover:text-white transition-colors duration-300 relative">
                                <span className="absolute top-6 right-6 font-display font-bold text-6xl opacity-10 group-hover:opacity-20">{item.step}</span>
                                <h3 className="text-3xl font-bold mb-4 font-display">{item.title}</h3>
                                <p className="text-gray-500 group-hover:text-white/90 font-medium max-w-xs">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Feature Grid */}
            <section className="py-32 bg-black text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="mb-16">
                        <h2 className="text-5xl md:text-6xl font-display font-bold mb-6 leading-tight">
                            A Full Website — <br />
                            <span className="text-brand-500">Built Instantly.</span>
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            "Responsive Design",
                            "SEO-Ready Structure",
                            "Uses Your Existing Photos",
                            "Auto-Written Service Pages",
                            "Colors That Match Your Brand",
                            "Optional Custom Domain",
                            "Integrated Lead Forms",
                            "Built-In Flynn Receptionist",
                            "Auto Quotes, CRM & Follow-Ups"
                        ].map((feature, idx) => (
                            <div key={idx} className="flex items-center space-x-4 border border-white/10 p-6 hover:border-brand-500 transition-colors duration-300 bg-white/5 backdrop-blur-sm">
                                <div className="flex-shrink-0 w-8 h-8 bg-brand-500 flex items-center justify-center text-black">
                                    <Check size={18} strokeWidth={3} />
                                </div>
                                <span className="font-bold text-lg">{feature}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-32 bg-brand-500 relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[15vw] font-bold text-black opacity-5 whitespace-nowrap font-display select-none">
                    FLYNN SITES
                </div>

                <div className="max-w-4xl mx-auto px-4 relative z-10 text-center">
                    <h2 className="text-5xl md:text-7xl font-bold text-white font-display mb-8 tracking-tight">
                        Your Website. Powered by Flynn.
                    </h2>
                    <p className="text-xl text-black/60 mb-12 max-w-xl mx-auto font-medium">
                        Generate your site, unlock it with a subscription, and run your entire business from one OS.
                    </p>
                    <button className="bg-black text-white hover:bg-white hover:text-black px-12 py-6 text-xl font-bold uppercase tracking-widest border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,255,255,0.3)] transition-all hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]">
                        Generate My Website
                    </button>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default Sites;
