# Twilio Health Checks & Operational Runbook

FlynnAI now logs call routing + voicemail activity into `call_events` so we can see when calls drop back to voicemail, recordings fail, or job creation errors occur. Use these steps to keep the telephony stack green before and after TestFlight/App Store releases.

## 1. Daily/Pre-release Checklist

1. **Verify auto-provisioned numbers**
   ```bash
   node scripts/check-forwarding-health.js
   ```
   - Flags any `phone_numbers` rows that are still `verification_state != verified`, missing `connected_number`, or stuck in `status != active`.
   - Also surfaces `call_events` like `call_routed_voicemail`, `transcription_failed`, and `job_creation_failed` in the last 24 hours.
2. **Investigate warnings**
   - For each flagged org:
     1. Open Supabase → `phone_numbers` row and confirm the `connected_number` matches the customer’s public line.
     2. Ask the customer to dial `*72 + FlynnNumber` again (US carriers) or toggle conditional forwarding in their carrier portal.
     3. Once forwarding is live, tap “Enable Forwarding” inside the app or hit the `/telephony/inbound-voice` route to confirm we log `ai_receptionist_engaged`.
3. **Watch call events**
   - Supabase → `call_events`: filter by org to view a timeline of:
     - `call_inbound_received` → request arrived.
     - `call_routed_voicemail` → fallback reason (missing AI requirements, user set voicemail-only).
     - `recording_stored` / `transcription_completed` / `job_creation_failed`.
   - Use this when debugging customer complaints about missed calls or stuck jobs.

## 2. Alerting Hooks

- **Forwarding toggles**: Every time a customer enables/disables forwarding (Call Setup or Call Settings), we update `phone_numbers.verification_state` and log `forwarding_attempt`. You can build alerts from the `call_events` table for repeated `call_routed_voicemail` events per org.
- **Recording/transcription**: `recording_stored`, `transcription_completed`, and `transcription_failed` events now fire automatically. Hook them into your monitoring provider (Datadog/Sentry) via Supabase webhooks if you need real-time paging.

## 3. Manual Recovery Steps

1. **Number stuck in “reserved/pending”**
   - Run `node scripts/check-forwarding-health.js` to list the org.
   - In Twilio Console (Incoming Phone Numbers), confirm the Voice URL points to `SERVER_PUBLIC_URL/telephony/inbound-voice`.
   - If provisioning failed, release the number in Twilio and re-run the app’s “Provision Number” flow.
2. **Forwarding disabled in carrier portal**
   - Ask the customer to dial `*720` (US carriers) to clear previous rules, then `*72 + FlynnNumber` to reapply.
   - Re-open the Call Settings screen; once we detect active forwarding, it flips status and logs `ai_receptionist_engaged`.
3. **Transcription/job extraction failures**
   - Check `call_events` for `transcription_failed` or `job_creation_failed`.
   - Inspect the underlying recording via `/telephony/calls/:callSid/recording`.
   - Retry job extraction manually via `ensureJobForTranscript` (run from a script or a quick API endpoint).

Document each incident in Shortcut with the org ID and relevant `call_events` rows so we can track recurring issues.
