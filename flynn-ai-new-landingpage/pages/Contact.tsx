import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Mail, MessageSquare, Phone } from 'lucide-react';

const Contact: React.FC = () => {
    return (
        <>
            <Helmet>
                <title>Contact - Flynn AI | Support & Sales</title>
                <meta name="description" content="Get in touch with Flynn AI. Chat with us, email support, or try calling (good luck!). 24/7 support for your business." />
            </Helmet>

            <div className="bg-white min-h-screen pt-20 pb-32 px-6">
                <div className="max-w-7xl mx-auto text-center mb-16">
                    <h1 className="text-6xl md:text-8xl font-bold font-display text-black mb-6 tracking-tighter">
                        Get in <span className="text-brand-500">Touch.</span>
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto font-medium">
                        We're here to help you automate.
                    </p>
                </div>

                <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
                    {/* Chat */}
                    <div className="bg-surface-50 p-10 border-2 border-transparent hover:border-black transition-all hover:translate-y-[-4px] hover:shadow-[8px_8px_0px_0px_#000000]">
                        <div className="w-16 h-16 bg-white border-2 border-black flex items-center justify-center mb-6">
                            <MessageSquare size={32} className="text-brand-500" />
                        </div>
                        <h3 className="text-2xl font-bold font-display mb-2">Live Chat</h3>
                        <p className="text-gray-600 mb-6">Chat with our team directly. Average response time: 2 mins.</p>
                        <button className="text-brand-500 font-bold uppercase tracking-wider border-b-2 border-brand-500 hover:text-black hover:border-black transition-colors">
                            Start Chat
                        </button>
                    </div>

                    {/* Email */}
                    <div className="bg-surface-50 p-10 border-2 border-transparent hover:border-black transition-all hover:translate-y-[-4px] hover:shadow-[8px_8px_0px_0px_#000000]">
                        <div className="w-16 h-16 bg-white border-2 border-black flex items-center justify-center mb-6">
                            <Mail size={32} className="text-brand-500" />
                        </div>
                        <h3 className="text-2xl font-bold font-display mb-2">Email Support</h3>
                        <p className="text-gray-600 mb-6">For technical issues or partnership inquiries.</p>
                        <a href="mailto:support@flynnai.app" className="text-brand-500 font-bold uppercase tracking-wider border-b-2 border-brand-500 hover:text-black hover:border-black transition-colors">
                            support@flynnai.app
                        </a>
                    </div>

                    {/* Phone */}
                    <div className="bg-surface-50 p-10 border-2 border-transparent hover:border-black transition-all hover:translate-y-[-4px] hover:shadow-[8px_8px_0px_0px_#000000] relative overflow-hidden">
                        <div className="w-16 h-16 bg-white border-2 border-black flex items-center justify-center mb-6">
                            <Phone size={32} className="text-brand-500" />
                        </div>
                        <h3 className="text-2xl font-bold font-display mb-2">Phone</h3>
                        <p className="text-gray-600 mb-6 font-medium">
                            +1 (555) 012-3456
                        </p>
                        <p className="text-xs text-gray-400 italic">
                            (Only available if you like talking to voicemail... shouldn't you assume we use our own AI?)
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Contact;
