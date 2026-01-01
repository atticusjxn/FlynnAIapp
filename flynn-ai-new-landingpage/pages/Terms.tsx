import React from 'react';
import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link to="/" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
        <p className="text-gray-600 mb-12">Last Updated: January 2, 2025</p>

        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              By accessing or using Flynn AI ("the Service"), you agree to be bound by these Terms of Service.
              If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Description of Service</h2>
            <p className="text-gray-700 leading-relaxed">
              Flynn AI is an inbound lead management platform that captures missed calls and converts them into
              revenue through automated SMS booking and quote links, with optional AI voice assistance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. User Accounts</h2>
            <p className="text-gray-700 leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials and for all
              activities that occur under your account. You must notify us immediately of any unauthorized use
              of your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Call Recording and Privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              Flynn AI may record and transcribe incoming calls to your business. You are responsible for
              complying with all applicable laws regarding call recording and consent in your jurisdiction.
              Flynn AI provides tools to help you meet these requirements, including recording disclosure messages.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Billing and Payment</h2>
            <p className="text-gray-700 leading-relaxed">
              Subscription fees are billed in advance on a monthly or annual basis. You authorize us to charge
              your payment method for all fees. Fees are non-refundable except as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Data Usage and AI Processing</h2>
            <p className="text-gray-700 leading-relaxed">
              The Service uses AI to process voicemails, transcribe calls, and extract job details. By using
              the Service, you grant Flynn AI permission to process this data to provide the Service to you.
              We do not use your data to train AI models for third parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Acceptable Use</h2>
            <p className="text-gray-700 leading-relaxed">
              You agree not to use the Service for any unlawful purpose, to spam users, or to violate any
              telecommunications regulations. Flynn AI reserves the right to suspend or terminate accounts
              that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Third-Party Services</h2>
            <p className="text-gray-700 leading-relaxed">
              The Service integrates with third-party platforms including Twilio, OpenAI, Deepgram, and
              accounting software. Your use of these integrations is subject to their respective terms of service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Limitation of Liability</h2>
            <p className="text-gray-700 leading-relaxed">
              Flynn AI is provided "as is" without warranties of any kind. We are not liable for any indirect,
              incidental, or consequential damages arising from your use of the Service, including missed calls
              or lost business opportunities.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Changes to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              We reserve the right to modify these Terms of Service at any time. We will notify you of material
              changes via email or in-app notification. Your continued use of the Service after changes
              constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Termination</h2>
            <p className="text-gray-700 leading-relaxed">
              You may terminate your account at any time through the app settings. We may terminate or suspend
              your account for violations of these terms. Upon termination, your data will be retained according
              to our data retention policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Governing Law</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms are governed by the laws of the jurisdiction where Flynn AI operates. Any disputes
              will be resolved through binding arbitration.
            </p>
          </section>

          <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact Us</h2>
            <p className="text-gray-700 mb-2">
              If you have questions about these Terms of Service, please contact us at:
            </p>
            <a
              href="mailto:support@flynnai.app"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              support@flynnai.app
            </a>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-600">
            © {new Date().getFullYear()} Flynn AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
