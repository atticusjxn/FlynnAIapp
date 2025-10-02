**Next Tickets**

- **Replace Mock Data**  
  - Swap `ClientsScreen` to read/write Supabase (list, detail, CRUD) and remove `mockClients`.  
  - Update settings/profile screens to load real user data (business name/type, contact info) and persist edits.  
  - Ensure job form demos pull live data or hide behind dev-only flag.

- **Thread Business Type Everywhere**  
  - Store the user’s `business_type` on every new job record coming from telephony + manual creation.  
  - Pass business type into OpenAI prompts (`OpenAIService`, Twilio extraction pipeline) to improve summaries.  
  - Update UI (job cards, filters, follow-ups) to use stored type; allow editing in settings.

- **Harden Call Setup & Provisioning**  
  - Lock Twilio flows to real credentials in production; add config validation + error surfaces.  
  - Finish provisioning UX: request number, confirm webhook URLs, surface status to the user.  
  - Add monitoring for failed recordings/transcriptions and retries.

- **Finalize Account & Settings**  
  - Implement profile edit, business type change, password reset/sign-out through Supabase Auth.  
  - Handle push-token registration state and expose status to the user.  
  - Document privacy/export flows; ensure data export path is functional or hidden.

- **Push Notifications E2E**  
  - Verify Expo/FCM/APNs credentials; implement server-side error logging + retries.  
  - Add client-side fallback when tokens missing/invalid; surface notification preferences.

- **Manual QA & Launch Readiness**  
  - Create step-by-step QA checklist covering onboarding → call → job → follow-up, including Twilio flows.  
  - Capture outstanding bugs, update docs (README, ops runbook), and prep App Store submission assets.
