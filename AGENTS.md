# Repository Guidelines

## Product Focus
Flynn is an autonomous back-office employee for trade businesses and deskless operators (plumbers, electricians, builders, cleaners, etc.). Rather than forcing users to do data entry in complex SaaS dashboards, Flynn runs entirely over native text messaging (SMS/iMessage/WhatsApp) and handles invoicing, receipt logging, scheduling, supplier price comparisons, and payment chasing.

We operate on a decoupled UI paradigm:
*   **System of Action (iMessage/SMS/WhatsApp)**: The primary conversational interface. The user texts Flynn to execute tasks (e.g. sending invoices, logging expenses via receipt photos, rescheduling weather-impacted jobs).
*   **System of Record & Viewing (Companion App & Web Portal)**: A visual cabinet that reflects what Flynn's agent has already done. Users open the app to review itemized quotes, manage credentials, or look at their business health dashboard, which dynamically reshapes itself based on text conversations.

Flynn does not replace accounting systems like Xero or MYOB; it demotes them to "dumb ledgers" in the background. Flynn acts as the active billing and interface layer that generates native Flynn invoice links, collects payments (via PayTo/PayID/Airwallex/Stripe), and pushes clean journal entries to Xero automatically.

## Project Structure & Module Organization
*   `src/`: The Expo mobile app (companion app).
    *   `src/screens/`: Feature screens (dashboard, onboarding, settings).
    *   `src/components/`: Reusable UI widgets.
    *   `src/theme/`: Theme tokens (designed with a mid-century, high-contrast, brutalist aesthetic using Space Grotesk + Inter).
    *   `src/services/`: Supabase, API, and third-party accessors.
*   `flynn-ai-new-landingpage/`: The marketing landing page (Vite + React + Tailwind, deployed on Cloudflare Pages via Wrangler).
*   `services/`: Backend logic, AI tool loops (built with Claude Code, running agentic workflows), and API connectors (Xero, Google Calendar, Resend, Sendblue, senderZ, Twilio).
*   `routes/`: Inbound webhooks for handling text messages and auth.
*   `brand/`: Master logos, vector assets, and app store screenshots.

## Build, Test, and Development Commands
*   **Mobile App**:
    *   Install dependencies: `npm install`
    *   Start Metro server: `npm start` (or `expo start`)
    *   Run platform builds: `npm run ios`, `npm run android`, `npm run web`
*   **Landing Page**:
    *   Navigate: `cd flynn-ai-new-landingpage`
    *   Install dependencies: `npm install`
    *   Local dev: `npm run dev`
    *   Deploy to Cloudflare Pages: `npm run cf:deploy`

## Coding Style & Naming Conventions
*   TypeScript-first codebase.
*   Use 2-space indentation, single quotes, and trailing commas.
*   Theme: Primary brand color is Orange/Coral (`#FB5B1E` / `#f46430`), secondary background is Cream (`#F4E6CE` / `#f5ebe0`), and text is Dark Ink/Charcoal (`#2C2018` / `#34302f`).
*   Keep React state local to components unless shared context belongs in `src/context`.

## Testing Guidelines
*   Exercise new flows through Expo Go or local test suites.
*   Before launching SMS/iMessage changes, test the webhook handling using local seed payloads.
*   Test and verify vCard attachment payloads and photo-invoice rendering layouts.
