# FlynnAI Mobile Release Checklist

Follow this list whenever we prep a TestFlight / Google Play build.

## 1. Versioning & Config
1. Update `app.config.js` `version`, `ios.buildNumber`, `android.versionCode` (done for 1.1.0).
2. Run `npm version <semver>` if we need to bump `package.json` for OTA tracking.
3. Confirm `runtimeVersion.policy` is `nativeVersion` so EAS OTA updates stay in sync.

## 2. Supabase / Twilio sanity
1. Apply new migrations in staging, then production (`supabase db push --include-all`).
2. Run `node scripts/check-forwarding-health.js` – resolve any `verification_state != verified`.
3. In Twilio Console, verify incoming phone numbers point to `SERVER_PUBLIC_URL/telephony/inbound-voice`.
4. Inspect `call_events` for repeated `call_routed_voicemail` or `transcription_failed` rows.

## 3. QA Pass
1. Sign up a fresh user → onboarding wizard (website, receptionist) should auto-create an org + Flynn number.
2. Provision number + forward calls:
   - Confirm Call Settings shows Flynn number + “Forwarding Verified”.
   - Make a test call and verify event + job creation in Dashboard.
3. Exercise key screens (Dashboard, Calendar, Jobs, Receptionist) on both iOS and Android devices.
4. Verify push notifications (register device, send a test job).

## 4. Builds & Submission
1. `npm install` (locked versions) then `npm run release:eas`.
2. Attach release notes + privacy answers in App Store Connect / Play Console.
3. Upload screenshots/video showing the “flynn concierge” events terminology.
4. Record manual QA steps and attach to the PR, referencing this checklist.

## 5. Post-release Monitoring
1. Watch `call_events` for `call_routed_voicemail` spikes immediately after release.
2. Check Supabase logs for failed Edge Functions / webhook handlers.
3. Keep `docs/TwilioHealth.md` handy for the on-call engineer.
