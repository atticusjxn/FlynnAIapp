# Flynn AI Store Submission Checklist

Use this document to prep both App Store and Google Play submissions. It distils the requirements from `docs/app-store-deployment.md` into a single actionable list.

## 1. Policy Links
- Privacy Policy URL: host `docs/privacy-policy.md` at `https://flynnai.com/privacy`.
- Terms of Service URL: host `docs/terms-of-service.md` at `https://flynnai.com/terms`.
- Support URL: `https://flynnai.com/support` or help desk landing page.

## 2. App Privacy Questionnaire (Apple)
| Data Type | Collected? | Linked to User? | Used for Tracking? | Purpose |
| --- | --- | --- | --- | --- |
| Contact Info (Name, Email, Phone) | Yes | Yes | No | Account management, support |
| User Content (Voicemail audio, transcripts, job notes) | Yes | Yes | No | App functionality |
| Diagnostics (Crash/Performance logs) | Yes | No | No | App performance |
| Device IDs (Push tokens) | Yes | Yes | No | Notifications |
| Usage Data (In-app actions) | Yes | Yes | No | Analytics + product improvement |
| Sensitive Info (Call audio) | Yes | Yes | No | Core feature; disclose recording consent |

Actions:
- In App Store Connect → App Privacy → “Data Linked to the User” include the rows above.
- State “Data is not used for tracking.”
- Mention that audio is user-generated, stored 90 days by default, and is deletable upon request.

## 3. Data Safety Form (Google Play)
- **Data collected:** Same categories as above.
- **Encryption:** Yes, all data encrypted in transit and at rest.
- **Data deletion:** Provide in-app request (support@flynnai.com) and automatic retention windows.
- **Purpose selections:** App functionality, analytics, account management.
- **No sharing for advertising or profiling.**

## 4. Required Assets
- App icon (1024×1024 PNG, no transparency).
- 6.5" and 5.5" iOS screenshots, 1290×2796 / 1242×2208.
- Optional App Preview video (15–30 sec portrait).
- Feature graphic (Play Store) 1024×500.
- Signing certificates & provisioning profiles already configured per `docs/app-store-deployment.md`.

## 5. Build & Release Steps
1. Confirm `.env` / secrets set for production (Supabase, Twilio, Stripe, ElevenLabs, push keys).
2. Run `npm run lint` (if configured) and `npm test` (manual QA notes attached).  
   - Manual QA: Onboarding w/ trial, receptionist config, fake call simulator, upgrade gating, webhook plan update.
3. Run `eas build --platform ios --profile production` and `--platform android`.
4. Upload `.ipa` via Transporter or `eas submit ios --profile production`.  
   Upload `.aab` to Play Console via `eas submit android --profile production`.
5. Complete store metadata forms referencing this checklist.
6. Attach privacy policy + terms URLs under App Information / Store Presence.
7. Provide account credentials for reviewers (demo login) and voicemail sample script in Review Notes.

## 6. Review Notes Template
```
Flynn AI provisions a virtual concierge number and forwards missed calls. Use the demo account below:
Email: review+flynn@flynnai.com
Password: ********

1. Log in, skip provisioning.
2. Open AI Receptionist tab > "Start test call" to hear scripted Koala demo without provisioning.
3. To provision a live number, go to Settings > Call Setup (requires paid plan; contact us if you need a reviewer plan upgrade).

Stripe test card: 4242 4242 4242 4242, exp 12/34, CVC 123.
```

## 7. Compliance Reminders
- Greeting must disclose recording + AI reception (“Hi, this call may be recorded and answered by Flynn AI”).
- Honour caller deletion requests within 30 days.
- Keep webhook logs (Stripe, Supabase) for audit trail.
- Update this checklist if data practices change.

Maintaining this document ensures we submit consistent, policy-compliant builds every release.
