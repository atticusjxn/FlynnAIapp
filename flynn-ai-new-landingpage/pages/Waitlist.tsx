import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import WaitlistForm from '../components/WaitlistForm';

const Waitlist: React.FC = () => {
  const { ref } = useParams();

  return (
    <main className="min-h-screen bg-[#F4E6CE] text-[#2C2018] flex items-center justify-center px-5 py-16">
      <Helmet>
        <title>Join the Flynn waitlist</title>
      </Helmet>
      <div className="w-full max-w-md">
        <img src="/mascots/phone.png" alt="" aria-hidden="true" className="w-24 h-24 mb-6" draggable={false} />
        <h1 className="font-display font-bold text-4xl leading-tight">Flynn isn't taking new signups right now.</h1>
        <p className="mt-4 text-lg text-[#5A4A3C] leading-relaxed">
          Leave your email and we'll let you know when it opens up again.
        </p>
        <WaitlistForm source="start" refCode={ref} className="mt-8" />
        <Link to="/" className="inline-block mt-6 text-sm font-semibold text-[#5A4A3C] underline hover:text-[#FB5B1E]">
          Back to flynnai.app
        </Link>
      </div>
    </main>
  );
};

export default Waitlist;
