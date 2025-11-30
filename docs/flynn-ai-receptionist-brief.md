# FlynnAI Receptionist Pivot Brief

## Context
- Existing product focuses on real-time call forwarding, transcription, and automated job card creation for trades and service businesses.
- Most foundational features remain valuable: job card templates per sector, screenshot ingestion, calendar sync, and roadmap items such as invoicing and accounting integrations.
- Live-call recording is operationally difficult (compliance, reliability). Pivot centers on capturing missed calls/voicemails, processing them with AI, and driving timely follow-ups.

## Positioning & Value Proposition
"Flynn turns missed calls into booked jobs." Flynn receives forwarded voicemails, transcribes and classifies them, drafts responses, and syncs the resulting work into calendars and financial systems. Existing live-call capabilities stay on the long-term roadmap as an upsell.

### Core Messaging Pillars
- **Never miss a lead**: conditional call forwarding or dedicated lines route voicemails straight into Flynn.
- **Fast follow-ups**: AI-generated summaries, job cards, and templated SMS/email replies with owner approval.
- **Unified workflow**: jobs flow into Flynn’s templates, calendar, invoices, and accounting integrations.
- **Friendly brand**: laid-back flynn mascot with optional persona voice packs keeps the experience approachable.

## Target Users
- Tradespeople, beauty/service professionals, and small business owners who can’t answer every call but rely on inbound leads.
- Office managers handling call overflow who want structured triage and automated follow-up.
- Businesses already experimenting with AI tools but lacking a coherent voicemail workflow.

## Current Strengths to Preserve
- Screenshot upload → job card pipeline.
- Sector-specific job templates and status stages.
- Planned PDF invoicing, receipt/expense tracking, and MYOB/QuickBooks integrations.
- Dashboard and calendar views already in place.

## Pivot Highlights
1. **Voicemail Intake**
   - Primary path: carrier conditional call forwarding to a Flynn/Twilio number.
   - Alternate: provisioned Flynn number for customers unable to configure forwarding.
   - Future: integrations with VoIP/PBX providers for direct voicemail routing.

2. **Greeting & Persona System**
   - Let users upload their existing voicemail greeting, record a new one, or choose a flynn-themed persona (male/female, accents) generated via TTS.
   - Cache generated greetings in storage for fast playback on incoming calls.

3. **Transcription & Classification Pipeline**
   - Twilio (or equivalent) posts voicemail recording metadata to Flynn backend.
   - Audio stored securely (S3/Supabase) with defined retention policy.
   - Transcribe via Whisper/Deepgram; run transcript through AI summarizer + job card extractor.
   - Tag confidence for manual review; highlight key entities (client name, service, urgency).

4. **Job Card & Follow-Up Workflow**
   - Draft job cards pre-filled with transcript summary, contact info, and recommended service template.
   - Provide an approval screen where owners can edit before saving and triggering automation.
   - Auto-draft SMS/email replies; maintain approval logs and opt-in settings per contact.
   - Offer calendar sync (Flynn calendar + Google/Apple) with one-tap scheduling.

5. **Financial & CRM Extensions**
   - Continue roadmap for PDF invoices, receipt scanning, Apple/Google Wallet expense storage.
   - Finalize MYOB/QuickBooks syncing for invoices and customer records.

## Technical Approach Snapshot
- **Call Routing**: Use Twilio Studio/Functions for voicemail capture and webhook delivery; document carrier-specific forwarding codes.
- **Storage & Privacy**: Enforce recording retention windows; ensure consent/disclosure messaging in greetings per region.
- **Transcription**: Start with async processing (recordingCompleted webhook → transcription job). Consider media streams only if near-real-time is needed later.
- **AI Processing**: Reuse existing job card parser, add classification for voicemail context, maintain audit trail of AI suggestions.
- **Messaging**: Integrate with Twilio SendGrid/SMS for outbound communications; include manual approval gates.
- **Monitoring**: Log pipeline steps (call received, transcription complete, job created, message sent) with retry/backoff strategies.

## Experience Priorities
- Onboarding wizard for call forwarding setup (carrier selector, instructions, verification call test).
- Dashboard modules highlighting recent voicemails, pending approvals, and follow-up SLAs.
- Flynn persona selector exposed during greeting setup and in confirmation screens to reinforce brand tone.
- Accessibility: clear transcript display, edit tools, and message templates.

## Roadmap Outline
1. **Voicemail MVP** (Now)
   - Forwarding setup UX.
   - Backend pipeline (recording → transcript → job draft).
   - Job review UI with manual approval.

2. **Automated Follow-Up** (Next)
   - Template manager for SMS/email.
   - Approval queue and analytics on response times.
   - Basic flynn voice greetings.

3. **Financial Integrations** (Soon)
   - Invoice generation from job cards.
   - Receipt scanning + wallet pass storage.
   - MYOB/QuickBooks sync completion.

4. **Premium Voice & Live Call Roadmap** (Later)
   - Persona library expansion.
   - Live-call assisted receptionist as premium add-on once operational hurdles resolved.

## Metrics & Success Criteria
- % of missed calls captured via Flynn within 30 days of onboarding.
- Median time from voicemail receipt to job approval.
- Follow-up conversion rate (voicemails leading to scheduled jobs).
- Retention: monthly active businesses using voicemail pipeline vs. legacy features.
- Revenue: upsell adoption of automated follow-ups and financial integrations.

## Risks & Mitigations
- **Carrier forwarding friction**: provide step-by-step guides and live verification; offer backup Flynn number.
- **Compliance**: maintain regional voicemail consent scripts and storage policies; expose audit logs.
- **AI accuracy**: keep human-in-the-loop approvals; surface low-confidence flags.
- **User trust**: ensure easy edits to transcripts/messages and track who approved what.

## Immediate Next Steps
1. Validate Twilio voicemail flow end-to-end in staging; document webhook payloads.
2. Design onboarding/forwarding setup screens with flynn persona preview.
3. Define API contracts for voicemail ingestion, transcription, and job creation.
4. Update backlog with MVP stories and acceptance criteria tied to this brief.
