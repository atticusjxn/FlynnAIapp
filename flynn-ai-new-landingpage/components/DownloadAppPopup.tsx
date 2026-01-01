import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone, ArrowRight } from 'lucide-react';
import StoreButtons from './StoreButtons';

interface DownloadAppPopupProps {
    isOpen: boolean;
    onClose: () => void;
    feature?: string;
}

const DownloadAppPopup: React.FC<DownloadAppPopupProps> = ({ isOpen, onClose, feature }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    />

                    {/* Popup */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white border-[3px] border-black shadow-[12px_12px_0px_0px_#ff4500] overflow-hidden"
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <div className="p-8 pb-0 text-center">
                            <div className="w-16 h-16 bg-brand-500 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_#000] rotate-3">
                                <Smartphone className="text-white" size={32} />
                            </div>

                            <h3 className="font-display font-bold text-3xl mb-3">
                                Get the Full Experience
                            </h3>

                            <p className="text-gray-600 mb-8 text-lg">
                                {feature ? (
                                    <>To manage <strong>{feature}</strong>, you'll need the mobile app.</>
                                ) : (
                                    "Log in to the Flynn app to access all features."
                                )}
                                <br />
                                Get real-time notifications, manage calls, and more.
                            </p>
                        </div>

                        <div className="bg-gray-50 p-8 pt-4 border-t-2 border-dashed border-gray-200">
                            <div className="flex flex-col gap-4 items-center">
                                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Download for free</p>
                                <StoreButtons />
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default DownloadAppPopup;
