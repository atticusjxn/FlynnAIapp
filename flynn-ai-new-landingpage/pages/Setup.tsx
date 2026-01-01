import React, { useState } from 'react';
import { Phone, MessageSquare, Save, Info } from 'lucide-react';
import DownloadAppPopup from '../components/DownloadAppPopup';

const Toggle = ({ active, onClick }: { active: boolean; onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${active ? 'bg-brand-500' : 'bg-gray-300'}`}
    >
        <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${active ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
);

const Section = ({ title, description, icon: Icon, children }: any) => (
    <div className="bg-white border-2 border-gray-100 rounded-xl p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 text-black">
                <Icon size={24} />
            </div>
            <div>
                <h3 className="font-display font-bold text-xl mb-1">{title}</h3>
                <p className="text-gray-500 text-sm max-w-lg">{description}</p>
            </div>
        </div>
        <div className="pl-0 md:pl-16">
            {children}
        </div>
    </div>
);

const Setup = () => {
    const [callForwarding, setCallForwarding] = useState(false);
    const [smsFollowUp, setSmsFollowUp] = useState(true);
    const [popupFeature, setPopupFeature] = useState<string | undefined>(undefined);
    const [showPopup, setShowPopup] = useState(false);

    const handleProtectedAction = (feature: string) => {
        setPopupFeature(feature);
        setShowPopup(true);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <header className="mb-8">
                <h1 className="text-3xl font-display font-bold mb-2">Setup & Settings</h1>
                <p className="text-gray-500">Configure how Flynn handles your calls and messages.</p>
            </header>

            <Section
                title="Call Forwarding"
                description="When enabled, calls to your Flyyn number will be forwarded to your personal phone if the AI doesn't pick up."
                icon={Phone}
            >
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div>
                        <p className="font-bold text-sm uppercase mb-1">Status</p>
                        <p className={callForwarding ? "text-green-600 font-bold" : "text-gray-500"}>
                            {callForwarding ? "Active" : "Disabled"}
                        </p>
                    </div>
                    <Toggle active={callForwarding} onClick={() => handleProtectedAction('Call Forwarding')} />
                </div>
                <div className="mt-4 flex items-start gap-2 text-xs text-gray-500 bg-blue-50 p-3 rounded text-blue-800">
                    <Info size={14} className="mt-0.5 flex-shrink-0" />
                    You'll need to verify your phone number in the mobile app before enabling this.
                </div>
            </Section>

            <Section
                title="SMS Follow-Up"
                description="Automatically send a text message to missed calls with a booking link or quote form."
                icon={MessageSquare}
            >
                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                    <div>
                        <p className="font-bold text-sm uppercase mb-1">Status</p>
                        <p className={smsFollowUp ? "text-green-600 font-bold" : "text-gray-500"}>
                            {smsFollowUp ? "Active" : "Disabled"}
                        </p>
                    </div>
                    <Toggle active={smsFollowUp} onClick={() => handleProtectedAction('SMS Follow-Up')} />
                </div>

                <div className="space-y-4 opacity-60 pointer-events-none select-none">
                    <div>
                        <label className="block font-bold text-sm uppercase mb-2">Message Template</label>
                        <textarea
                            className="w-full bg-[#f3f4f6] border border-gray-300 p-3 rounded-lg text-sm resize-none"
                            rows={3}
                            defaultValue="Hey! Sorry I missed you. I'm currently on a job. Feel free to book a time here: [Link]"
                        />
                    </div>
                </div>

                <div className="mt-4">
                    <button
                        onClick={() => handleProtectedAction('Message Templates')}
                        className="text-sm font-bold text-brand-500 hover:text-brand-600 flex items-center gap-1"
                    >
                        Edit Template in App
                    </button>
                </div>
            </Section>

            <div className="flex justify-end pt-4">
                <button
                    onClick={() => handleProtectedAction('Settings')}
                    className="bg-black text-white px-8 py-3 font-bold font-display uppercase tracking-widest hover:bg-brand-500 transition-colors flex items-center gap-2"
                >
                    <Save size={18} /> Save Changes
                </button>
            </div>

            <DownloadAppPopup
                isOpen={showPopup}
                onClose={() => setShowPopup(false)}
                feature={popupFeature}
            />
        </div>
    );
};

export default Setup;
