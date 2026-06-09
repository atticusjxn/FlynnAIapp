# Flynn AI — Project Context & Design System

## What Flynn Is

Flynn is a **text-based business agent** that lives in iMessage. Service operators text Flynn like a smart mate who knows their business — and Flynn handles the admin: drafting replies, booking jobs, creating invoices, ordering parts. Flynn texts back, executes actions, and learns the business over time.

**One promise:** "Run your business from iMessage."

The iOS keyboard extension is a secondary surface — useful once the user is set up, but not the onboarding gate. The primary funnel is: land on flynnai.app → tap Message Flynn → start texting.

## Who It's For

Service operators who run their business from their phone: tradies, removalists, cleaners, PTs, salons, real estate agents, freelancers. Vertical-agnostic — Flynn adapts its questions and suggestions to whatever industry it detects. Go-to-market focus is AU/NZ tradies.

## Core Principles

- **Text is the interface.** Flynn lives in iMessage. No app required to get value.
- **Brain-first.** Every response uses the user's actual pricing, availability, and client context. Generic responses are a bug.
- **Conversational onboarding.** Brain setup happens over SMS — Flynn asks questions naturally, never uses the word "setup" or "profile".
- **Proactive but not pushy.** Flynn re-engages users who go quiet, sends reminders, flags important messages. But stops after 3 attempts and never nags.
- **Context accumulates passively.** Flynn learns from every exchange — if the user mentions a new rate or client, it's saved. Never asks the same question twice.
- **Confirm before executing.** For anything irreversible (sending an invoice, placing an order), Flynn sends a confirmation message first. User replies "yeah" to proceed.
- **Mobile is primary.** Dashboard and app are secondary surfaces for power users.

## Primary Architecture

```
Landing page (flynnai.app)
  → "Message Flynn" CTA → opens iMessage to Flynn's number
  → User texts Flynn → BlueBubbles relay on Mac → Flynn backend
  → Flynn replies via iMessage (blue bubbles)

Flynn number: dedicated eSIM (amaysim AU, Optus network)
Relay: BlueBubbles server on Mac (Private API — read receipts + typing indicators)
Backend: Node.js/Express on Fly.io (flynnai-telephony.fly.dev)
Brain: Supabase (zvfeafmmtfplzpnocyjw, ap-southeast-2)
LLM: Qwen3.5-flash via DashScope (fast, cheap, natural tone)
```

## Surfaces

### 1. iMessage (primary — where users live)
- Conversational onboarding, brain building, action execution
- Re-engagement messages for inactive users
- Confirmation flows for invoices, bookings, orders
- See `plans/conversational-onboarding.md`

### 2. Web dashboard (flynnai.app/dashboard)
- Integration management (Google Calendar, Xero, Gmail etc)
- Brain viewer/editor
- Upcoming jobs, open quotes, flagged leads
- OAuth flows for all integrations
- See `plans/dashboard.md` and `plans/integrations.md`

### 3. iOS app (secondary — power users)
- Keyboard extension: screenshot → OCR → draft → tap to insert
- Integrations tab (same as web)
- Brain tab (same as web)
- Dashboard tab
- Onboarding stripped to 3 steps — brain setup is SMS-based
- See `plans/ios-app.md`

## Non-Goals — Do Not Build

- Voice training or voice cloning
- Always-on screen recording or clipboard harvesting
- Autonomous sending without confirmation (invoices, orders always confirm first)
- Any UX or marketing leading with "AI"
- Multi-user / team features (solo operators only for now)
- Desktop app or browser extension (not in current scope)

## Message Tone — Non-Negotiable

Flynn's SMS replies must read like a real person texted them, not a product.

- Start messages lowercase where natural ("hey", "got it", "done")
- Never use em dashes (—) — use commas or short sentences
- No bullet points in SMS — prose only
- No filler openers: never "Great!", "Sure!", "Absolutely!"
- Contractions always: I'll, you've, can't
- Short sentences. Two short ones beat one long one.
- Currency: infer from phone prefix (+61 → AUD, +64 → NZD, +1 → USD)

All outbound messages pass through `sanitiseReply()` which strips em dashes and other AI tells before sending.

## The Priority

Validate with real users. Measure **week-4 retention**. Everything else is secondary.

---

## ⚠️ Reconciliation Notes

| Prior version | Status |
|---|---|
| Keyboard-first product ("assistive AI that drafts replies") | **Superseded** — iMessage agent is primary surface |
| "Flynn never sends anything on its own" | **Updated** — Flynn sends proactively (re-engagement, confirmations) but always confirms before irreversible actions |
| Screenshot capture / OCR / keyboard insert as core loop | **Secondary** — still built, but not the onboarding path |
| IVR, telephony, voicemail pipeline | **Retired** |
| "Inbound Revenue OS" positioning | **Retired** |

**What is kept:** brand identity, mascot, design system (colors, typography, spacing, components), Supabase schema, Twilio for SMS fallback, development rules.

---

## 🎨 Design System Overview

FlynnAI uses React Native's built-in StyleSheet API as the foundation for all UI components. This document outlines the design rules, patterns, and best practices for maintaining consistency across the application.

### Brand Personality
- **Friendly and approachable** — Laid-back Flynn mascot (orange #FB5B1E winking chat-bubble on cream #F4E6CE)
- **Professional and reliable** — Service providers need to trust Flynn with their messages
- **Efficient and time-saving** — Focus on fast, accurate reply drafts
- **Human-in-the-loop** — Manual insert gates maintain control and quality
- **Accessible to non-tech-savvy users** — Simple, intuitive interfaces

## 🎯 Design Principles

1. **Consistency** — All UI elements follow the same design patterns
2. **Simplicity** — Clean, uncluttered interfaces that focus on functionality
3. **Accessibility** — High contrast ratios and clear typography
4. **Performance** — Lightweight styles using StyleSheet.create()
5. **Maintainability** — Reusable components and centralized theme

## 🎨 Color Palette

### Primary Colors
```javascript
const colors = {
  // Brand Colors
  primary: '#2563EB',      // Bright blue - primary actions, links
  primaryDark: '#1E40AF',  // Darker blue - pressed states
  primaryLight: '#DBEAFE', // Light blue - backgrounds, highlights

  // Neutral Colors (Grays)
  secondary: '#64748B',    // Slate gray - secondary text
  gray50: '#F8FAFC',       // Lightest gray - backgrounds
  gray100: '#F1F5F9',      // Very light gray - cards
  gray200: '#E2E8F0',      // Light gray - borders
  gray300: '#CBD5E1',      // Medium light gray - disabled states
  gray400: '#94A3B8',      // Medium gray - placeholder text
  gray500: '#64748B',      // Base gray - secondary text
  gray600: '#475569',      // Dark gray - body text
  gray700: '#334155',      // Darker gray - headings
  gray800: '#1E293B',      // Very dark gray - primary text
  gray900: '#0F172A',      // Darkest gray - high emphasis

  // Semantic Colors
  success: '#10B981',      // Green - success states, confirmations
  successLight: '#D1FAE5', // Light green - success backgrounds

  warning: '#F59E0B',      // Amber - warnings, attention
  warningLight: '#FEF3C7', // Light amber - warning backgrounds

  error: '#EF4444',        // Red - errors, destructive actions
  errorLight: '#FEE2E2',   // Light red - error backgrounds

  // UI Colors
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
}
```

### Color Usage Guidelines

- **Primary (#2563EB)**: Trust/reliability — Main CTAs, primary buttons, active states, links
- **Secondary (#64748B)**: Secondary text, less important information
- **Success (#10B981)**: Completed actions — Success messages, confirmed bookings, inserted drafts
- **Warning (#F59E0B)**: Pending items — Items requiring attention
- **Error (#EF4444)**: Failed processes — Errors, destructive actions, validation errors
- **Grays**: Background layers, borders, disabled states, text hierarchy

### Brand Color Meanings
- **Primary Blue**: Conveys trust, reliability, and professionalism
- **Success Green**: Clear indication of completed actions and successful processes
- **Warning Amber**: Draws attention to pending items without being alarming
- **Error Red**: Reserved for actual problems that need immediate attention

## 📝 Typography

### Font Family
```javascript
const fonts = {
  ios: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  android: {
    regular: 'Roboto',
    medium: 'Roboto-Medium',
    bold: 'Roboto-Bold',
  }
}
```

### Type Scale
```javascript
const typography = {
  displayLarge:  { fontSize: 32, lineHeight: 40, fontWeight: '700' },
  displayMedium: { fontSize: 28, lineHeight: 36, fontWeight: '700' },

  h1: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  h2: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  h4: { fontSize: 16, lineHeight: 22, fontWeight: '600' },

  bodyLarge:  { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  bodySmall:  { fontSize: 12, lineHeight: 16, fontWeight: '400' },

  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  label:   { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  button:  { fontSize: 16, lineHeight: 24, fontWeight: '600' },
}
```

## 📏 Spacing System

Based on 4px unit system for consistent spacing:

```javascript
const spacing = {
  xxxs: 2,   // 2px  - Minimal spacing
  xxs:  4,   // 4px  - Tight spacing
  xs:   8,   // 8px  - Small spacing
  sm:   12,  // 12px - Compact spacing
  md:   16,  // 16px - Default spacing
  lg:   24,  // 24px - Large spacing
  xl:   32,  // 32px - Extra large spacing
  xxl:  48,  // 48px - Huge spacing
  xxxl: 64,  // 64px - Maximum spacing
}
```

## 🎛️ Component Patterns

### FlynnButton
```javascript
const FlynnButton = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary:   { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.gray100, borderWidth: 1, borderColor: colors.gray300 },
  success:   { backgroundColor: colors.success },
  danger:    { backgroundColor: colors.error },
  pressed:   { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled:  { backgroundColor: colors.gray300, opacity: 0.6 },
  small:  { paddingVertical: 8,  paddingHorizontal: 16 },
  medium: { paddingVertical: 12, paddingHorizontal: 24 },
  large:  { paddingVertical: 16, paddingHorizontal: 32 },
})
```

### FlynnCard
```javascript
const FlynnCard = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  content: { flex: 1 },
  footer:  { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.gray200 },
})
```

### FlynnInput
```javascript
const FlynnInput = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label:     { fontSize: 14, fontWeight: '500', color: colors.gray700, marginBottom: spacing.xxs },
  input: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.gray800,
    backgroundColor: colors.white,
  },
  focused:    { borderColor: colors.primary, borderWidth: 2 },
  error:      { borderColor: colors.error },
  disabled:   { backgroundColor: colors.gray100, color: colors.gray400 },
  helperText: { fontSize: 12, color: colors.gray500, marginTop: spacing.xxs },
  errorText:  { fontSize: 12, color: colors.error,   marginTop: spacing.xxs },
})
```

## 📱 Layout Guidelines

### Container Padding
- Screen containers: 24px horizontal padding
- Cards: 16px padding
- List items: 16px vertical, 20px horizontal

### Border Radius
```javascript
const borderRadius = {
  none: 0,
  xs:   4,
  sm:   6,
  md:   8,    // Default for buttons, inputs
  lg:   12,   // Cards, modals
  xl:   16,   // Large cards
  full: 9999, // Pills, badges
}
```

### Shadows
```javascript
const shadows = {
  sm: { shadowColor: colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1,  shadowRadius: 4, elevation: 2 },
  lg: { shadowColor: colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
}
```

## 💼 Flynn AI Specific Component Patterns

### Draft Cards
- Substantial, tappable, with clear visual hierarchy
- Show draft text, confidence that business context was used, one-tap insert action
- Medium shadows to feel elevated and important

### Action Buttons
- Prominent and finger-friendly (minimum 44×44px)
- Primary actions use brand blue
- Success states use green for inserted/confirmed states
- Loading states with subtle animations for feedback

### Status Indicators
- Green = inserted / confirmed, Amber = pending review, Red = issues
- Include text labels alongside colors for accessibility
- Subtle badges or pills, not overwhelming visual elements

### Modern Design Elements
- Subtle shadows for elevation and depth
- Rounded corners (8–12px) for friendly, approachable feel
- Micro-interactions for user feedback (button press states, loading animations)
- Clean typography hierarchy to guide attention

### Dark Mode
- All colors should have dark mode variants
- Maintain contrast ratios for accessibility
- Darker backgrounds with lighter elevated elements

## 🔧 Implementation Guidelines

### Creating Styled Components

Always use StyleSheet.create() for performance:
```javascript
// ✅ Good
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 }
});

// ❌ Bad — inline styles
<View style={{ flex: 1, backgroundColor: '#F8FAFC' }} />
```

Import theme constants from the centralized location:
```javascript
import { colors, spacing, typography } from '../theme';
```

Component structure pattern:
```javascript
const ComponentName = ({ variant = 'primary', size = 'medium', ...props }) => (
  <TouchableOpacity
    style={[styles.base, styles[variant], styles[size], props.disabled && styles.disabled, props.style]}
    {...props}
  >
    {children}
  </TouchableOpacity>
);
```

### Responsive Design
```javascript
import { Dimensions } from 'react-native';
const { width } = Dimensions.get('window');
const responsive = {
  isSmallDevice:  width < 375,
  isMediumDevice: width >= 375 && width < 768,
  isLargeDevice:  width >= 768,
  value: (small, medium, large) => width < 375 ? small : width < 768 ? medium : large,
}
```

## 🗣️ Language & Copy Guidelines

### Terminology
- Say **"draft"** or **"reply"** — not "response", not "message"
- Say **"Insert"** — not "Send" (Flynn never sends)
- Say **"Your calendar"** — not "the calendar"
- Say **"Tap to insert"** — not "Click send"
- Say **"job"** or **"booking"** — not "appointment" (tradesperson-friendly)
- Keep copy concise — users are busy and on-the-go

### Voice & Tone
- **Friendly but professional** — like a sharp assistant who knows your business
- **Action-oriented** — "Insert reply", "Book slot", "Edit draft"
- **Encouraging** — "Draft ready", "Slot booked", "Inserted"
- **Clear status** — "Reading message…", "Drafting…", "Ready to insert"
- **Human-in-the-loop** — "Tap to insert", "Review before inserting", "Edit draft"

### Button Labels
- ✅ "Insert" (not "Send")
- ✅ "Edit Draft" (not "Modify")
- ✅ "Book Slot" (not "Schedule")
- ✅ "Set Up Business" (not "Configure Profile")
- ✅ "Try Again" (not "Retry")

### Status Messages
- ✅ "Draft ready — tap to insert"
- ✅ "Slot booked in your calendar"
- ✅ "Reading your message…"
- ✅ "Inserted"
- ❌ "API call completed"
- ❌ "Message sent successfully"
- ❌ "Data processed"

## 📋 Component Checklist

When creating new components:

- [ ] Use StyleSheet.create() for all styles
- [ ] Follow color palette strictly (trust blue, success green, warning amber)
- [ ] Apply consistent spacing using the 4px system
- [ ] Include pressed/disabled states for interactive elements
- [ ] Add proper shadows for elevated components
- [ ] Test on both iOS and Android
- [ ] Ensure accessibility (min touch target 44×44px)
- [ ] Document component props with TypeScript
- [ ] Create reusable variants (primary, secondary, etc.)
- [ ] Follow naming conventions (FlynnComponentName)
- [ ] Use client-focused language in labels and copy
- [ ] Consider dark mode variants
- [ ] Add micro-interactions for user feedback

## 🚀 Usage Example

```javascript
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors, spacing, typography, shadows } from '../theme';

const FlynnDraftCard = ({ draft, onInsert }) => (
  <TouchableOpacity style={styles.card} onPress={onInsert} activeOpacity={0.7}>
    <View style={styles.header}>
      <Text style={styles.label}>Draft reply</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Uses your pricing</Text>
      </View>
    </View>
    <Text style={styles.body}>{draft.text}</Text>
    <View style={styles.footer}>
      <Text style={styles.hint}>Tap anywhere to insert</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  label:  { ...typography.h4, color: colors.gray800, flex: 1 },
  badge:  { paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: 16, backgroundColor: colors.primaryLight },
  badgeText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  body:   { ...typography.bodyMedium, color: colors.gray700, marginBottom: spacing.sm },
  footer: { paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.gray200 },
  hint:   { ...typography.caption, color: colors.gray400 },
});

export default FlynnDraftCard;
```

## 🎯 Flynn AI Design Priorities

### User Experience Focus
1. **Speed** — Capture → draft must feel instant
2. **Clarity** — Users should never wonder what to do next
3. **Trust** — Visual design must inspire confidence; always show that context was used
4. **Efficiency** — Minimize steps to insert a reply or book a slot

### Key UI Patterns
- **Keyboard**: Draft cards with one-tap insert; business context badge; calendar slot picker
- **Draft Cards**: Show preview, indicate business context was applied, quick insert + edit
- **Calendar Picker**: Real slots only; confirm books the event; user always taps to confirm
- **Business Setup**: One-time wizard; services, pricing, hours, area; shown as "context used" in drafts
- **Approval Flows**: "Insert", "Edit", "Skip" — never auto-send
- **Error Handling**: Gentle, helpful messages with next steps

## 💼 Accounting Integration (Roadmap)

Flynn AI will integrate with major accounting platforms so service providers can invoice from completed job cards without double data entry.

### Supported Platforms (planned)
- **MYOB** — AU/NZ focus
- **QuickBooks** — US/global small business
- **Xero** — Cloud-first SMB

### Planned Features
- Send invoice for a completed booking
- Create quote from a draft interaction
- Log job expenses
- Sync client data (two-way)

### UX Intent
- Clear connection status (green = connected, gray = disconnected)
- One-tap accounting actions from completed job cards
- OAuth setup flow; integration management in Settings

## 📱 iOS Shortcuts / Screenshot Capture

The screenshot surface is Flynn's recommended capture path. The Shortcuts action captures the current screen (not saved to camera roll), on-device OCR extracts the conversation text, and the keyboard pre-loads drafts so the user can insert with one tap.

### URL Scheme: `flynn-ai://process-screenshot`
```
flynn-ai://process-screenshot?imageData=[base64_encoded_image]
```

### Shortcut Setup (user-guided from Settings)
1. Open Shortcuts app
2. Create new shortcut:
   - Take Screenshot
   - Base64 Encode
   - Open URL: `flynn-ai://process-screenshot?imageData=[encoded_image]`
3. Assign to Action Button (iPhone 15 Pro+, 16+) or Back Tap (triple-tap)

### Key Services
- **ShortcutHandler** — URL scheme processing and routing
- **OCR / Vision** — On-device text extraction from screenshot
- **DraftService** — Passes extracted text + business context to draft model (Qwen3.5-flash via DashScope)
- **KeyboardViewController** — Auto-loads staged drafts for tap-to-insert

### Supported Message Sources
- SMS / iMessage
- WhatsApp
- Email
- Any messaging app visible on screen

### Environment
```bash
DASHSCOPE_API_KEY=your_key_here   # Qwen3.5-flash draft model
```

## 🚫 Development Rules

### NEVER Run Development Servers
- **DO NOT** use `npm start`, `npm run dev`, `expo start`, or any similar commands
- **DO NOT** attempt to start development servers or preview environments
- The user will handle all server/preview management themselves
- Focus only on code implementation and file changes

### Why This Rule Exists
- Development servers are managed by the user in their local environment
- Starting servers can interfere with the user's existing development setup

## 🔄 Version History

- **v3.0.0** — Pivot to assistive keyboard reply drafter + calendar booking (June 2025)
  - New product: screenshot/clipboard capture → keyboard drafts → tap to insert
  - Retired telephony system (IVR, Twilio, Deepgram Voice Agent, voicemail pipeline)
  - Core principle: assistive only, never autonomous
  - Target: week-4 retention with real service-operator users
- **v2.0.0** — Voicemail receptionist pivot (January 2025)
- **v1.0.0** — Initial design system (December 2024)

---

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
