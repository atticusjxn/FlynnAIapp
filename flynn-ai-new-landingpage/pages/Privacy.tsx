import React from 'react';
import { Link } from 'react-router-dom';

export default function Privacy() {
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
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
        <p className="text-gray-600 mb-12">Last Updated: April 27, 2026</p>

        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Who We Are</h2>
            <p className="text-gray-700 leading-relaxed">
              Flynn AI ("Flynn", "we", "our", "us") is an inbound lead-management
              service for tradespeople and small service businesses. This policy
              explains what personal information we collect, why we collect it,
              and the choices you have.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Information We Collect</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              <strong>Account information.</strong> When you sign up we collect
              your mobile number (for SMS verification) and/or email address,
              along with the business name, business phone number, business email,
              and website URL you choose to provide.
            </p>
            <p className="text-gray-700 leading-relaxed mb-3">
              <strong>Call and message data.</strong> When Flynn answers a call
              forwarded to your business number, we capture the caller's phone
              number, the audio recording, the transcript, and any details our
              AI extracts (caller name, requested service, address, and similar).
              When Flynn sends booking or quote SMS links on your behalf, we
              record delivery status.
            </p>
            <p className="text-gray-700 leading-relaxed mb-3">
              <strong>Billing information.</strong> Subscription payments are
              processed by Apple, Google, or Stripe. We receive transaction
              status and a non-identifying receipt token; we do not see or store
              card numbers.
            </p>
            <p className="text-gray-700 leading-relaxed mb-3">
              <strong>Device and usage data.</strong> When you use the Flynn
              mobile app we automatically collect device model, operating
              system version, app version, crash logs, and basic interaction
              events (screens viewed, features used). On iOS we ask permission
              before collecting the IDFA used for advertising attribution.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Marketing measurement data.</strong> We use the Meta
              (Facebook) SDK and SKAdNetwork to measure which ad campaigns
              brought you to Flynn. Where required by your platform settings
              we ask permission before any tracking-related data is collected.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. How We Use It</h2>
            <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-2">
              <li>To provide the Flynn service: receiving forwarded calls, sending booking/quote links, drafting follow-ups, and surfacing missed-call leads in your app.</li>
              <li>To verify it's you when you sign up or sign in (SMS or email one-time codes).</li>
              <li>To process payments, manage subscriptions, and prevent fraud.</li>
              <li>To improve product reliability via crash logs and aggregated usage.</li>
              <li>To measure the performance of our marketing campaigns and serve relevant ads about Flynn (we never use your customers' call data for advertising).</li>
              <li>To meet our legal obligations and respond to lawful requests.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Sub-processors We Share With</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              We share the minimum information necessary with the following
              service providers, each of which is contractually required to use
              the data only to provide their service to Flynn:
            </p>
            <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-1">
              <li><strong>Supabase</strong> — database, authentication, storage</li>
              <li><strong>Telnyx, Twilio</strong> — telephony (call forwarding, SMS)</li>
              <li><strong>Stripe</strong> — web subscription billing</li>
              <li><strong>Apple App Store, Google Play Billing</strong> — in-app subscriptions</li>
              <li><strong>OpenAI, Google Gemini, Deepgram, Cartesia, ElevenLabs</strong> — AI transcription, language understanding, voice synthesis</li>
              <li><strong>Meta Platforms</strong> — ad attribution, app-install measurement</li>
              <li><strong>Cloudflare, Vercel, Fly.io</strong> — hosting and content delivery</li>
              <li><strong>Sentry</strong> — crash and error monitoring (if/when enabled)</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              We do not sell your personal information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Where Your Data Is Stored</h2>
            <p className="text-gray-700 leading-relaxed">
              Account data and call records are stored in Supabase (Sydney,
              Australia region). Some sub-processors (notably AI providers and
              Meta) operate from the United States and other jurisdictions.
              Data transferred internationally is protected by contractual
              safeguards consistent with applicable privacy laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. How Long We Keep It</h2>
            <p className="text-gray-700 leading-relaxed">
              We retain account data for as long as your account is active. Call
              recordings and transcripts are retained for the period configured
              in your account (default: 90 days), then permanently deleted.
              Billing records are kept for the period required by tax law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Your Choices and Rights</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              You can:
            </p>
            <ul className="list-disc list-inside text-gray-700 leading-relaxed space-y-2">
              <li><strong>Access or export</strong> your data — email us at the address below.</li>
              <li><strong>Correct</strong> account details — directly in the app's settings.</li>
              <li><strong>Delete</strong> your account — from the app's settings, or by emailing us. Deletion is permanent.</li>
              <li><strong>Opt out</strong> of ad tracking — disable App Tracking Transparency on iOS or "Limit Ad Tracking" on Android.</li>
              <li><strong>Refuse marketing emails</strong> — every marketing email contains an unsubscribe link.</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              Depending on where you live (e.g. EU/UK, California, Australia)
              you may have additional statutory rights, including the right to
              lodge a complaint with your local data-protection authority.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Call Recording &amp; Consent</h2>
            <p className="text-gray-700 leading-relaxed">
              Flynn records and transcribes calls forwarded to your business
              number. You are responsible for ensuring callers receive the
              disclosure required by the laws of your jurisdiction. Flynn
              provides built-in greeting templates that include the standard
              recording disclosure; you must keep these enabled where they are
              legally required.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Children</h2>
            <p className="text-gray-700 leading-relaxed">
              Flynn is intended for business owners and is not directed at
              anyone under 16. We do not knowingly collect personal information
              from children.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Security</h2>
            <p className="text-gray-700 leading-relaxed">
              We use industry-standard security: TLS in transit, encryption at
              rest, scoped access tokens, and row-level security in Supabase.
              No system is perfectly secure — if we ever discover a breach
              affecting your data we will notify you as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Changes to This Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this policy as Flynn evolves. Material changes will
              be announced in the app or by email at least 14 days before they
              take effect. The "Last Updated" date at the top reflects the most
              recent revision.
            </p>
          </section>

          <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact Us</h2>
            <p className="text-gray-700 mb-2">
              For privacy questions, data requests, or account deletion:
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
