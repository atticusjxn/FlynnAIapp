# iOS App Rebuild

## Goal
Strip the app back to the core value proposition — the keyboard extension and brain context. Onboarding is now SMS-based so the app is no longer the primary surface. It becomes the power-user layer on top of the text agent.

## What the app is NOT anymore
- Not the onboarding gate (that's the landing page + SMS)
- Not a voice trainer
- Not a call handler
- Not a standalone product — it enhances the text agent

## What the app IS
- Keyboard extension host (the core insert-draft mechanic)
- Integration management (connect Google Calendar, Xero etc)
- Brain viewer/editor (see what Flynn knows about your business, correct it)
- Conversation history (Flynn's memory of past jobs, quotes, clients)
- Dashboard (see the auto-generated context view — see dashboard plan)

## Tab structure (simplified)

### 1. Keyboard (default tab)
- Instructions for setting up the keyboard extension
- Preview of recent drafts
- Status: keyboard active / inactive
- Shortcut setup (Action Button or Back Tap)

### 2. Brain
- What Flynn knows about the business (read from `business_brain` JSONB)
- Editable fields — tap any fact to correct it
- "Things Flynn is still learning" — gaps in the brain shown as prompts
- Version history (last updated x days ago)

### 3. Integrations
- Same card grid as web (see integrations plan)
- Native SwiftUI, `ASWebAuthenticationSession` for OAuth
- Apple Calendar via EventKit (no OAuth needed)

### 4. Dashboard
- Auto-generated context view (see dashboard plan)
- Initially: upcoming jobs, recent quotes, open invoices, flagged emails

## Onboarding (new — much shorter)
Old onboarding had voice training, multiple steps, lots of friction. New flow:

1. **Phone number entry** — verify via SMS (or skip if they came from landing page)
2. **Keyboard setup** — one screen, guided, skip available
3. **Done** — "Flynn is texting you now to learn your business"

That's it. Brain setup happens over SMS. App just gets out of the way.

## Keyboard extension changes
- Remove voice training references
- Remove old IVR/call draft UI
- Focus: screenshot capture → draft → insert
- Show "context used" badge when draft uses brain data (pricing, calendar)
- Drafts load faster now that brain is richer from SMS onboarding

## What to keep from existing codebase
- `FlynnKeyboard/` — keyboard extension (update UI, keep mechanics)
- `BrainStore.swift` — update to read from new JSONB schema
- `BrainView.swift` — rebuild as editable brain viewer
- `OnboardingCoordinator.swift` — gut to 3 steps
- Mascot / brand assets — keep all
- Supabase client, auth — keep

## What to remove
- Voice demo onboarding step (`LiveVoiceDemoStepView`)
- Practice step (`PracticeStepView`)
- Phone number IVR references
- Calls tab

## App Store positioning update
**Before:** "AI receptionist for tradies"
**After:** "Your business brain in your keyboard — draft replies and book jobs without leaving your messages"

Focus on keyboard + calendar. Don't lead with AI.
