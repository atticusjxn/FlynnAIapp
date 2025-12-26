import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { CheckCircle2, Briefcase, Scissors, Stethoscope, UtensilsCrossed, Wrench, Sparkles } from 'lucide-react';
import StoreButtons from '../components/StoreButtons';
import { createTrialSignup } from '../services/supabase';

const BUSINESS_TYPES = [
  { value: 'tradie', label: 'Tradie', icon: Wrench, description: 'Plumber, Electrician, Builder' },
  { value: 'beauty', label: 'Beauty & Salon', icon: Scissors, description: 'Hair, Nails, Spa Services' },
  { value: 'health', label: 'Health & Clinic', icon: Stethoscope, description: 'Dental, Physio, Medical' },
  { value: 'hospitality', label: 'Restaurant & Cafe', icon: UtensilsCrossed, description: 'Food & Beverage' },
  { value: 'other', label: 'Other Services', icon: Briefcase, description: 'Professional Services' },
];

const Trial: React.FC = () => {
  const [email, setEmail] = useState('');
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!businessType) {
      setError('Please select your business type');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error: supabaseError } = await createTrialSignup(email, businessType);

      if (supabaseError) {
        setError(supabaseError.message);
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
      setIsSubmitting(false);

      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'trial_signup', {
          business_type: businessType,
        });
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <>
        <Helmet>
          <title>Welcome to Flynn AI! Download the App</title>
          <meta name="description" content="Your trial is ready! Download Flynn AI and start turning missed calls into booked jobs." />
        </Helmet>

        <div className="bg-white min-h-screen pt-20 pb-32 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 border-4 border-black mb-8">
                <CheckCircle2 size={48} className="text-green-600" />
              </div>
              <h1 className="text-5xl md:text-7xl font-bold font-display text-black mb-6 tracking-tighter">
                You're <span className="text-brand-500">In!</span>
              </h1>
              <p className="text-2xl text-gray-600 font-medium max-w-2xl mx-auto">
                Your 1-week free trial is ready. Here's what to do next:
              </p>
            </div>

            <div className="space-y-6 mb-16">
              <div className="bg-green-50 border-4 border-black p-8 relative">
                <div className="absolute -left-2 -top-2 w-12 h-12 bg-green-600 border-2 border-black flex items-center justify-center">
                  <span className="text-white font-bold text-xl font-display">✓</span>
                </div>
                <div className="ml-12">
                  <h3 className="text-2xl font-bold font-display mb-2">Step 1: Email Submitted</h3>
                  <p className="text-gray-700 font-medium">We've saved your details. You're all set!</p>
                </div>
              </div>

              <div className="bg-yellow-50 border-4 border-black p-8 relative">
                <div className="absolute -left-2 -top-2 w-12 h-12 bg-brand-500 border-2 border-black flex items-center justify-center">
                  <span className="text-white font-bold text-xl font-display">2</span>
                </div>
                <div className="ml-12">
                  <h3 className="text-2xl font-bold font-display mb-2">Step 2: Download Flynn AI</h3>
                  <p className="text-gray-700 font-medium mb-6">
                    Get the app on your phone. Available for iOS and Android.
                  </p>
                  <StoreButtons />
                </div>
              </div>

              <div className="bg-surface-50 border-4 border-gray-300 p-8 relative">
                <div className="absolute -left-2 -top-2 w-12 h-12 bg-gray-300 border-2 border-black flex items-center justify-center">
                  <span className="text-black font-bold text-xl font-display">3</span>
                </div>
                <div className="ml-12">
                  <h3 className="text-2xl font-bold font-display mb-2">Step 3: Sign In with Email Code</h3>
                  <p className="text-gray-700 font-medium">
                    Open the app, enter <span className="font-bold text-brand-500">{email}</span>, and use the email code to sign in. 
                    Your account will be automatically set up for your business!
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-surface-50 border-4 border-black p-10 text-center">
              <Sparkles size={40} className="text-brand-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold font-display mb-4">What Happens Next?</h3>
              <p className="text-gray-700 font-medium max-w-2xl mx-auto mb-6">
                Once you sign in, Flynn will be ready to answer your missed calls, transcribe voicemails, 
                and help you book more jobs. Your 1-week free trial starts as soon as you set up call forwarding.
              </p>
              <p className="text-sm text-gray-500">
                No credit card required • Cancel anytime • $79/month after trial
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Start Your Free Trial - Flynn AI</title>
        <meta name="description" content="Try Flynn AI free for 1 week. Turn missed calls into booked jobs. No credit card required." />
      </Helmet>

      <div className="bg-white min-h-screen pt-20 pb-32 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-6xl md:text-8xl font-bold font-display text-black mb-6 tracking-tighter leading-none">
              Start Your <span className="text-brand-500">Free Trial</span>
            </h1>
            <p className="text-2xl text-gray-600 font-medium max-w-2xl mx-auto mb-8">
              Never miss another dollar-500 job. Try Flynn AI free for 1 week.
            </p>
            
            <div className="flex flex-wrap justify-center gap-4 text-sm font-medium text-gray-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-600" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-600" />
                <span>1 week free</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-600" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <label htmlFor="email" className="block text-sm font-bold font-display uppercase tracking-wider mb-3">
                  Your Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-6 py-4 border-4 border-black text-lg font-medium focus:outline-none focus:ring-4 focus:ring-brand-500"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-bold font-display uppercase tracking-wider mb-4">
                  Select Your Business Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {BUSINESS_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isSelected = businessType === type.value;
                    
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setBusinessType(type.value)}
                        disabled={isSubmitting}
                        className={
                          isSelected 
                            ? 'p-6 border-4 bg-brand-500 border-black text-white shadow-[8px_8px_0px_0px_#000000] text-left transition-all' 
                            : 'p-6 border-4 bg-white border-gray-300 hover:border-black hover:shadow-[4px_4px_0px_0px_#000000] text-left transition-all'
                        }
                      >
                        <Icon size={32} className={isSelected ? 'text-white mb-3' : 'text-brand-500 mb-3'} />
                        <h3 className="font-bold font-display text-lg mb-1">{type.label}</h3>
                        <p className={isSelected ? 'text-sm text-white/90' : 'text-sm text-gray-600'}>
                          {type.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border-4 border-red-600 p-4">
                  <p className="text-red-800 font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-brand-500 text-white py-5 px-8 border-4 border-black font-bold font-display text-xl uppercase tracking-wider hover:bg-black hover:text-brand-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[8px_8px_0px_0px_#000000] hover:shadow-[4px_4px_0px_0px_#000000] hover:translate-y-[4px] hover:translate-x-[4px] active:shadow-none active:translate-y-[8px] active:translate-x-[8px]"
              >
                {isSubmitting ? 'Starting Your Trial...' : 'Start Free Trial'}
              </button>

              <p className="text-center text-sm text-gray-500">
                By starting your trial, you agree to our terms of service and privacy policy.
              </p>
            </form>
          </div>

          <div className="mt-24 grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-brand-500 border-4 border-black mx-auto mb-4 flex items-center justify-center">
                <span className="text-white font-bold text-2xl font-display">1</span>
              </div>
              <h3 className="text-xl font-bold font-display mb-2">AI Answers Calls</h3>
              <p className="text-gray-600">Never miss a job while you're working</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-brand-500 border-4 border-black mx-auto mb-4 flex items-center justify-center">
                <span className="text-white font-bold text-2xl font-display">2</span>
              </div>
              <h3 className="text-xl font-bold font-display mb-2">Extract Job Details</h3>
              <p className="text-gray-600">Flynn creates job cards automatically</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-brand-500 border-4 border-black mx-auto mb-4 flex items-center justify-center">
                <span className="text-white font-bold text-2xl font-display">3</span>
              </div>
              <h3 className="text-xl font-bold font-display mb-2">Follow Up Fast</h3>
              <p className="text-gray-600">Automated SMS responses while you work</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Trial;
