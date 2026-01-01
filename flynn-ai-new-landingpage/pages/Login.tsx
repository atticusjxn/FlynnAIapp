import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { signInWithEmail, signInWithGoogle, getSession } from '../services/auth';

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Check if already logged in
    useEffect(() => {
        const checkSession = async () => {
            const session = await getSession();
            if (session) {
                navigate('/dashboard');
            }
        };
        checkSession();
    }, [navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            await signInWithEmail(email, password);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Failed to sign in');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError('');

        try {
            await signInWithGoogle();
            // OAuth will redirect automatically
        } catch (err: any) {
            setError(err.message || 'Failed to sign in with Google');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f3f4f6] flex flex-col font-sans relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-500/5 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3"></div>

            <header className="p-6">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 font-display font-medium hover:text-brand-500 transition-colors"
                >
                    <ArrowLeft size={20} />
                    Back to Home
                </button>
            </header>

            <div className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="bg-white border-2 border-black p-8 shadow-[8px_8px_0px_0px_#000000]"
                    >
                        <div className="text-center mb-8">
                            <h1 className="font-display font-bold text-4xl mb-2">Welcome Back</h1>
                            <p className="text-gray-500">Log in to manage your AI receptionist</p>
                        </div>

                        {error && (
                            <div className="bg-red-50 border-2 border-red-500 text-red-700 px-4 py-3 mb-4 font-medium">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div>
                                <label className="block font-display font-bold text-sm uppercase mb-2">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-[#f3f4f6] border-2 border-black p-3 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-medium"
                                    placeholder="you@company.com"
                                    required
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block font-display font-bold text-sm uppercase">Password</label>
                                    <a href="#" className="text-xs text-gray-500 hover:text-black underline">Forgot?</a>
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#f3f4f6] border-2 border-black p-3 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-medium"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-black text-white py-4 font-bold font-display uppercase tracking-widest hover:bg-brand-500 transition-colors flex justify-center items-center gap-2 group disabled:opacity-70"
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        Processing...
                                    </span>
                                ) : (
                                    <>
                                        Sign In <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t-2 border-dashed border-gray-200">
                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={isLoading}
                                className="w-full bg-white border-2 border-gray-200 text-gray-700 py-3 font-display font-bold text-sm hover:border-black hover:text-black transition-all flex justify-center items-center gap-2 disabled:opacity-70"
                            >
                                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
                                Continue with Google
                            </button>
                        </div>

                        <div className="mt-6 text-center text-sm">
                            <span className="text-gray-500">Don't have an account? </span>
                            <button onClick={() => navigate('/trial')} className="font-bold border-b-2 border-black hover:text-brand-500 hover:border-brand-500 transition-colors">
                                Start Free Trial
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default Login;
