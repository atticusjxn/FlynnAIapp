# Flynn AI Design System & Project Context

## About Flynn AI
**"Flynn is your Inbound Revenue OS — never miss a lead, always follow up."**

Flynn AI is a comprehensive inbound lead management platform for busy service providers (tradespeople, beauty/service professionals, small business owners) that captures every missed call and converts it into revenue through automated SMS booking and quote links, with optional AI voice assistance for premium users.

### Core Value Proposition:
Flynn captures inbound calls when you're busy and immediately sends prospects a text with links to book appointments or request quotes — no voicemail needed. The default experience is instant, frictionless lead capture via SMS links. Businesses can upgrade to AI voice receptionists for conversational interactions, but the core product works without any AI configuration.

### Core Features:

#### Call Handling — Three Flexible Modes

Flynn supports three call handling modes that users can switch between:

**Mode A: SMS Link Follow-Up (Default)**
- Caller hears a brief greeting and automated menu
- Press 1 → Receive SMS with booking link
- Press 2 → Receive SMS with quote request form
- Press 3 → Leave voicemail (optional fallback)
- SMS sent immediately during the call
- No AI configuration required — works out of the box
- **This is the core product:** Simple, reliable, conversion-focused

**Mode B: AI Receptionist (Optional Premium)**
- Full conversational AI using Deepgram Voice Agent
- Ask questions, gather job details, schedule appointments
- AI-drafted follow-up SMS/email with manual approval
- Requires voice profile selection and conversation script setup
- Higher complexity but richer interaction

**Mode C: Voicemail Capture Only**
- Basic voicemail recording and transcription
- No IVR menu, no AI conversation
- Transcripts processed for job card creation
- Simple fallback for users who want minimal automation

#### Supporting Features
- **Booking Pages**: Shareable links with calendar integration (Google, Apple, Outlook)
- **Quote Intake Forms**: Collect job details, photos, and contact info via SMS link
- **Screenshot Upload**: Upload screenshots of text conversations → AI extracts job details → creates job cards
- **iOS Shortcuts Integration**: Control Center shortcut for instant screenshot processing
- **Job Confirmations**: Automatically send SMS confirmations to clients
- **Accounting Integration**: MYOB, QuickBooks, Xero integration for invoicing (roadmap)

### Target Users:
- Tradespeople, beauty/service professionals, and small business owners who can't answer every call but rely on inbound leads
- Office managers handling call overflow who want structured triage and automated follow-up
- Businesses already experimenting with AI tools but lacking a coherent voicemail workflow

### App Navigation (Current):
5 tabs: Dashboard (home), Events (Jobs), Calls (formerly Receptionist), Clients, Money (billing/accounting)

### Product Roadmap:

#### Phase 1: SMS Link Follow-Up MVP (Current)
- IVR menu with booking/quote link options
- Immediate SMS delivery during call
- Call forwarding setup UX with carrier-specific instructions
- Booking page with calendar integration
- Quote intake form with photo upload
- Basic call analytics (DTMF selections, SMS sent, conversions)

#### Phase 2: Enhanced Call Handling (Next)
- IVR template library (industry-specific, tone variants)
- Website scraping to auto-suggest IVR scripts
- Customizable IVR script editor
- Link click tracking and conversion metrics
- A/B testing for IVR messaging

#### Phase 3: AI Receptionist Premium (Later)
- Conversational AI with custom voice profiles
- AI-drafted follow-up messages with approval workflow
- Advanced lead qualification and routing
- Multi-language support

#### Phase 4: Team & Enterprise Features (Future)
- Multi-user collaboration
- Team call routing and assignment
- Advanced analytics dashboard
- CRM integrations (Salesforce, HubSpot)
- White-label options for agencies

## 🎨 Design System Overview

FlynnAI uses React Native's built-in StyleSheet API as the foundation for all UI components. This document outlines the design rules, patterns, and best practices for maintaining consistency across the application.

### Brand Personality:
- **Friendly and approachable** - Laid-back flynn mascot with optional persona voice packs
- **Professional and reliable** - Service providers need to trust Flynn with their leads
- **Efficient and time-saving** - Focus on fast follow-ups and lead conversion
- **Human-in-the-loop** - Manual approval gates maintain control and quality
- **Accessible to non-tech-savvy users** - Simple, intuitive interfaces

## 🎯 Core Principles

1. **Consistency**: All UI elements follow the same design patterns
2. **Simplicity**: Clean, uncluttered interfaces that focus on functionality
3. **Accessibility**: High contrast ratios and clear typography
4. **Performance**: Lightweight styles using StyleSheet.create()
5. **Maintainability**: Reusable components and centralized theme

## 🎨 Color Palette

### Primary Colors
```javascript
const colors = {
  // Brand Colors
  primary: '#2563EB',      // Bright blue - primary actions, links
  primaryDark: '#1E40AF',  // Darker blue - pressed states
  primaryLight: '#DBEAFE', // Light blue - backgrounds, highlights
  
  // Neutral Colors (Grays)
  secondary: '#64748B',     // Slate gray - secondary text
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

- **Primary (#2563EB)**: Trust/reliability - Main CTAs, primary buttons, active states, links
- **Secondary (#64748B)**: Secondary text, less important information
- **Success (#10B981)**: Completed jobs - Success messages, completed states, positive actions
- **Warning (#F59E0B)**: Pending items - Warning messages, caution states, items requiring attention
- **Error (#EF4444)**: Failed processes - Error messages, destructive actions, validation errors
- **Grays**: Background layers, borders, disabled states, text hierarchy

### Brand Color Meanings:
- **Primary Blue**: Conveys trust, reliability, and professionalism that service providers need
- **Success Green**: Clear indication of completed jobs and successful processes
- **Warning Amber**: Draws attention to pending items without being alarming
- **Error Red**: Reserved for actual problems that need immediate attention

## 📝 Typography

### Font Family
```javascript
const fonts = {
  // iOS
  ios: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
  },
  // Android
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
  // Display
  displayLarge: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700', // Bold
  },
  displayMedium: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700', // Bold
  },
  
  // Headers
  h1: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700', // Bold
  },
  h2: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600', // Semi-bold
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600', // Semi-bold
  },
  h4: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600', // Semi-bold
  },
  
  // Body
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400', // Regular
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400', // Regular
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400', // Regular
  },
  
  // Captions & Labels
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500', // Medium
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500', // Medium
  },
  button: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600', // Semi-bold
  },
}
```

## 📏 Spacing System

Based on 4px unit system for consistent spacing:

```javascript
const spacing = {
  xxxs: 2,   // 2px - Minimal spacing
  xxs: 4,    // 4px - Tight spacing
  xs: 8,     // 8px - Small spacing
  sm: 12,    // 12px - Compact spacing
  md: 16,    // 16px - Default spacing
  lg: 24,    // 24px - Large spacing
  xl: 32,    // 32px - Extra large spacing
  xxl: 48,   // 48px - Huge spacing
  xxxl: 64,  // 64px - Maximum spacing
}

// Usage in padding/margin
const containerPadding = spacing.md; // 16px
const sectionMargin = spacing.lg;    // 24px
const buttonPadding = spacing.sm;    // 12px
```

## 🎛️ Component Patterns

### FlynnButton
```javascript
const FlynnButton = StyleSheet.create({
  // Base button style
  base: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Variants
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  success: {
    backgroundColor: colors.success,
  },
  danger: {
    backgroundColor: colors.error,
  },
  
  // States
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    backgroundColor: colors.gray300,
    opacity: 0.6,
  },
  
  // Sizes
  small: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  medium: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  large: {
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
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
    
    // Shadow for iOS
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    
    // Shadow for Android
    elevation: 2,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  
  content: {
    flex: 1,
  },
  
  footer: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
})
```

### FlynnInput
```javascript
const FlynnInput = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.gray700,
    marginBottom: spacing.xxs,
  },
  
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
  
  focused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  
  error: {
    borderColor: colors.error,
  },
  
  disabled: {
    backgroundColor: colors.gray100,
    color: colors.gray400,
  },
  
  helperText: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: spacing.xxs,
  },
  
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.xxs,
  },
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
  xs: 4,
  sm: 6,
  md: 8,    // Default for buttons, inputs
  lg: 12,   // Cards, modals
  xl: 16,   // Large cards
  full: 9999, // Pills, badges
}
```

### Shadows
```javascript
const shadows = {
  sm: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
}
```

## 💼 Flynn AI Specific Component Patterns

### Job/Event Cards:
- Should feel substantial and actionable with clear visual hierarchy
- Use medium shadows to feel elevated and important
- Include clear status indicators (pending, in progress, completed)
- Show essential info: client name, job type, time, location
- Make entire card tappable for quick access

### Action Buttons:
- Must be prominent and finger-friendly (minimum 44x44px)
- Primary actions use brand blue for trust and reliability
- Success states use green for completed jobs
- Warning states use amber for items needing attention
- Loading states with subtle animations for feedback

### Status Indicators:
- Use color coding consistently: Green = completed, Amber = pending, Red = issues
- Include text labels alongside colors for accessibility
- Use subtle badges or pills, not overwhelming visual elements

### Modern Design Elements:
- Subtle shadows for elevation and depth
- Rounded corners (8-12px) for friendly, approachable feel
- Micro-interactions for user feedback (button press states, loading animations)
- Clean typography hierarchy to guide user attention

### Dark Mode Considerations:
- All colors should have dark mode variants
- Maintain contrast ratios for accessibility
- Use darker backgrounds with lighter elevated elements
- Ensure job status colors remain clear in dark mode

## 🔧 Implementation Guidelines

### Creating Styled Components

1. **Always use StyleSheet.create()** for performance optimization
```javascript
// ✅ Good
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  }
});

// ❌ Bad - inline styles
<View style={{ flex: 1, backgroundColor: '#F8FAFC' }} />
```

2. **Import theme constants** from centralized location
```javascript
import { colors, spacing, typography } from '../theme';
```

3. **Component structure** pattern:
```javascript
const ComponentName = ({ variant = 'primary', size = 'medium', ...props }) => {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        styles[size],
        props.disabled && styles.disabled,
        props.style, // Allow style overrides
      ]}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
};
```

### Responsive Design

```javascript
import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const responsive = {
  isSmallDevice: width < 375,
  isMediumDevice: width >= 375 && width < 768,
  isLargeDevice: width >= 768,
  
  // Responsive values
  value: (small, medium, large) => {
    if (width < 375) return small;
    if (width < 768) return medium;
    return large;
  },
}
```

## 🗣️ Language & Copy Guidelines

### Terminology:
- Use **"voicemail"**, **"job"** or **"lead"** instead of technical terms
- Say **"Send response"** not "Execute API call"
- Use **"Process voicemail"** not "Run transcription pipeline"
- Use **"Upload screenshot"** not "Process image data"
- Say **"Approve and send"** for manual approval workflows
- Keep copy concise - users are busy and on-the-go

### Voice & Tone:
- **Friendly but professional** - Like a helpful receptionist (the flynn mascot reinforces this)
- **Action-oriented** - "Create job", "Send response", "Approve reply", "View transcript"
- **Encouraging** - "Great! Your response has been sent", "New lead captured!"
- **Clear status updates** - "Transcribing...", "Processing voicemail", "Response sent", "Waiting for approval"
- **Human-in-the-loop language** - "Review before sending", "Approve response", "Edit draft"

### Button Labels:
- ✅ "Create Job" (not "Submit")
- ✅ "Approve & Send" (not "Execute")
- ✅ "Review Voicemail" (not "Open Recording")
- ✅ "Edit Response" (not "Modify Template")
- ✅ "View Transcript" (not "Show Text")
- ✅ "Set Up Forwarding" (not "Configure Integration")

### Status Messages:
- ✅ "Voicemail transcribed successfully"
- ✅ "Response sent to client"
- ✅ "Lead captured from voicemail"
- ✅ "Waiting for your approval"
- ✅ "Forwarding setup complete"
- ❌ "API call completed"
- ❌ "Webhook processed successfully"
- ❌ "Data successfully uploaded"

## 📋 Component Checklist

When creating new components:

- [ ] Use StyleSheet.create() for all styles
- [ ] Follow color palette strictly (trust blue, success green, warning amber)
- [ ] Apply consistent spacing using the 4px system
- [ ] Include pressed/disabled states for interactive elements
- [ ] Add proper shadows for elevated components (job cards should feel substantial)
- [ ] Test on both iOS and Android
- [ ] Ensure accessibility (min touch target 44x44px)
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

// Example: Job Card component following Flynn AI design principles
const FlynnJobCard = ({ job, onPress }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return colors.successLight;
      case 'pending': return colors.warningLight;
      case 'in_progress': return colors.primaryLight;
      default: return colors.gray200;
    }
  };

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{job.title}</Text>
        <View style={[styles.badge, { backgroundColor: getStatusColor(job.status) }]}>
          <Text style={styles.badgeText}>{job.status}</Text>
        </View>
      </View>
      
      <Text style={styles.clientName}>{job.clientName}</Text>
      <Text style={styles.location}>{job.location}</Text>
      
      <View style={styles.footer}>
        <Text style={styles.date}>{job.scheduledDate}</Text>
        <Text style={styles.time}>{job.scheduledTime}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Substantial, actionable card with medium shadow
  card: {
    backgroundColor: colors.white,
    borderRadius: 12, // Friendly, approachable corners
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.md, // Elevated feel for important job cards
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h4,
    color: colors.textPrimary, // High contrast for readability
    flex: 1,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: 16, // Pill shape for status
  },
  badgeText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  clientName: {
    ...typography.bodyMedium,
    color: colors.primary, // Brand blue for client names
    marginBottom: spacing.xxs,
  },
  location: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  date: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  time: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: '500',
  },
});

export default FlynnJobCard;
```

## 🎯 Flynn AI Design Priorities

### User Experience Focus:
1. **Speed** - Every interaction should feel immediate
2. **Clarity** - Users should never be confused about what to do next
3. **Trust** - Visual design should inspire confidence in the app's reliability
4. **Efficiency** - Minimize steps to complete common tasks

### Key UI Patterns:
- **Dashboard**: Quick overview of recent voicemails, pending approvals, follow-up SLAs, and key conversion metrics
- **Voicemail Cards**: Substantial cards showing caller info, transcript summary, urgency indicators, and quick actions
- **Job Cards**: Substantial, tappable cards with clear status indicators for scheduled work
- **Approval Flows**: Clear review interfaces with "Approve & Send", "Edit Draft", and "Skip" options
- **Action Buttons**: Large, prominent buttons for primary actions (especially approval workflows)
- **Status Feedback**: Clear, immediate feedback for all user actions (transcribing, sending, etc.)
- **Transcript Display**: Clean, readable transcript views with confidence indicators
- **Error Handling**: Gentle, helpful error messages with next steps

## 🔄 Version History

- **v2.0.0** - Voicemail receptionist pivot (January 2025)
  - New primary focus: "Flynn turns missed calls into booked jobs"
  - Added voicemail intake, transcription, and approval workflows
  - Introduced flynn persona greeting system
  - Updated brand personality and messaging
  - Preserved screenshot and iOS Shortcuts features as supporting functionality
- **v1.0.0** - Initial design system implementation (December 2024)
- Last updated: January 2025
- Maintained by: FlynnAI Development Team

---

**Note**: This design system should be the single source of truth for all UI decisions in the FlynnAI application. Any deviations should be discussed and documented.

## 💼 Accounting Integration

### Overview
Flynn AI integrates with major accounting software platforms to streamline financial management for service providers. Users can connect their preferred accounting software to automate invoicing, expense tracking, and financial reporting directly from completed job cards.

### Supported Platforms:
- **MYOB**: Complete accounting suite popular in Australia and New Zealand
- **QuickBooks**: Widely used small business accounting platform
- **Xero**: Cloud-based accounting software for small to medium businesses

### Integration Features:
- **Send Invoice**: Automatically create and send invoices for completed jobs to the connected accounting platform
- **Create Quote**: Generate professional quotes and estimates that can be converted to invoices
- **Log Expenses**: Track job-related expenses and materials costs for accurate profit calculations
- **Sync Client Data**: Two-way sync of client information between Flynn AI and accounting software
- **Financial Reporting**: Access to job profitability and revenue analytics

### Business Benefits:
- **Time Savings**: Eliminate double data entry between job management and accounting
- **Professional Invoicing**: Branded invoices sent directly from accounting software
- **Accurate Tracking**: Real-time expense tracking tied to specific jobs
- **Tax Compliance**: Proper categorization and record keeping for tax purposes
- **Cash Flow Management**: Faster invoicing leads to improved cash flow

### User Experience:
- Clear connection status indicators (green=connected, gray=disconnected)
- One-click accounting actions available on completed job cards
- Simple setup flow with OAuth authentication
- Integration management through Settings tab
- Automatic fallback gracefully handles disconnections

Focus on making business financial management seamless and professional while maintaining the Flynn AI design system's principles of simplicity and efficiency.

## 📱 iOS Shortcuts Integration

### Overview
Flynn AI includes a powerful iOS Shortcuts integration that allows users to capture and process screenshots directly from Control Center, making job creation incredibly fast and seamless.

### Features:
- **Control Center Access**: One-tap screenshot processing from Control Center
- **Automatic AI Processing**: Screenshots are automatically processed using OpenAI GPT-4 Vision
- **Smart Job Extraction**: AI identifies client details, job requirements, dates, times, and locations
- **Business Type Detection**: Automatically detects service type and uses appropriate job forms
- **Instant Job Creation**: Extracted data pre-populates job forms for quick confirmation

### How It Works:
1. **User swipes down** to open Control Center
2. **Taps Flynn AI Shortcut** button
3. **Screenshot is captured** automatically
4. **Flynn AI opens** and shows processing animation
5. **AI extracts job details** using OpenAI GPT-4 Vision
6. **Job form pre-populates** with extracted information
7. **User reviews and confirms** job creation

### Technical Implementation:

#### URL Scheme: `flynn-ai://process-screenshot`
The shortcut uses Flynn AI's custom URL scheme to pass screenshot data:
```
flynn-ai://process-screenshot?imageData=[base64_encoded_image]
```

#### Core Services:
- **ShortcutHandler**: Manages URL scheme processing and navigation
- **OpenAIService**: Handles AI-powered text extraction and job data parsing  
- **Deep Linking**: Automatically routes shortcut requests to processing flow

#### File Structure:
```
src/
├── services/
│   ├── ShortcutHandler.ts        # URL scheme handling
│   ├── OpenAIService.ts          # AI processing
│   └── OpenAIService.ts          # Image analysis
├── screens/
│   └── shortcuts/
│       └── ShortcutSetupScreen.tsx # Setup instructions
└── utils/
    └── shortcutDefinition.ts      # Shortcut configuration
```

### Setup Process:
Users can access shortcut setup through **Settings > App Settings > iOS Shortcuts**:

1. **Open Shortcuts App** (guided from Flynn AI)
2. **Create New Shortcut** with specific actions:
   - Take Screenshot
   - Base64 Encode 
   - Open URL: `flynn-ai://process-screenshot?imageData=[encoded_image]`
3. **Add to Control Center** for quick access
4. **Test functionality** through Flynn AI settings

### AI Processing:
- **Primary**: OpenAI GPT-4 Vision analyzes screenshots directly
- **Business Context**: Uses business-type-specific prompts for better accuracy
- **Data Extraction**: Identifies client name, phone, date, time, location, service type
- **Confidence Scoring**: Returns accuracy confidence for extracted data
- **Error Handling**: Graceful fallback with manual entry options

### Supported Text Sources:
- SMS/iMessage conversations
- WhatsApp screenshots  
- Email screenshots
- Social media messages
- Any text-based communication

### Configuration:
Environment variables needed:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

Add to `.env` file and ensure proper babel configuration for `react-native-dotenv`.

### Troubleshooting:
- **Shortcut not appearing**: Check "Use with Control Center" is enabled
- **Flynn AI not opening**: Verify URL scheme: `flynn-ai://process-screenshot`
- **Processing fails**: Ensure OpenAI API key is configured
- **Poor extraction**: Use screenshots with clear, readable text
- **Network issues**: Check internet connection for AI processing

## 📞 Call Handling System (Primary Feature)

### Overview
Flynn's core feature is its flexible call handling system that captures every missed call and converts it into revenue. The primary value proposition: **"Flynn is your Inbound Revenue OS — never miss a lead, always follow up."**

**Default Mode (SMS Link Follow-Up)**: When callers can't reach you, Flynn answers with an IVR menu and sends them booking or quote links via SMS — instant, frictionless lead capture with zero AI configuration required.

**Optional Premium Mode (AI Receptionist)**: Businesses can upgrade to conversational AI that asks questions, gathers details, and drafts personalized follow-ups.

### How Each Mode Works:

#### Mode A: SMS Link Follow-Up (Default)

**Call Flow:**
1. **Incoming Call**: Twilio receives forwarded call, Flynn answers immediately
2. **IVR Greeting**: Caller hears customizable greeting + menu options:
   - "Press 1 to receive a booking link"
   - "Press 2 to receive a quote form link"
   - "Press 3 to leave a voicemail"
3. **DTMF Input**: Caller presses digit during call
4. **Immediate SMS**: Flynn sends SMS within 2 seconds with requested link
5. **Confirmation**: Caller hears "Thanks — we've just texted you a booking link" and call ends

**IVR Script Customization:**
- **Template Library**: Choose from 8+ pre-built templates (professional, casual, trades-specific, etc.)
- **Custom Scripts**: Fully editable with placeholders: `{business_name}`, `{booking_option}`, `{quote_option}`
- **Website Scraping**: Auto-suggest IVR script based on scraped website tone and industry
- **Industry Variants**: Trades, beauty, events, home services, creative, emergency

**SMS Content:**
- Booking SMS: "Hi, this is {Business}. Book your appointment: {link}"
- Quote SMS: "Hi, this is {Business}. Share project details/photos here: {link}"
- Sent from business phone number (not Flynn number) to avoid confusion
- Includes "Reply STOP" compliance language

**Link Destinations:**
- **Booking Link**: Auto-generated booking page (`flynnbooking.com/{business-slug}`) with calendar integration
- **Quote Link**: Auto-generated quote intake form with photo upload, job details, contact info

**Edge Cases:**
- **Blocked Caller ID**: Play fallback message with short URL, don't attempt SMS
- **Invalid DTMF**: Replay menu once, then end call politely
- **Misconfigured Links**: Force fallback to voicemail, show in-app warning

#### Mode B: AI Receptionist (Optional Premium)

**Call Flow:**
1. **Incoming Call**: Twilio connects caller to Deepgram Voice Agent WebSocket
2. **AI Greeting**: Custom greeting script read by selected voice profile
3. **Conversation**: AI asks follow-up questions (configurable per business type)
4. **Entity Extraction**: AI extracts client name, phone, service type, date/time, location
5. **Job Card Draft**: Pre-filled job card created with transcript
6. **Follow-up SMS Draft**: AI-generated response message awaits manual approval
7. **Approval Workflow**: User reviews transcript, edits job details, approves/sends SMS

**Voice Profiles:**
- **Preset Voices**: flynn_warm (Avery), flynn_expert (Sloane), flynn_hype (Maya)
- **Custom Voice Cloning**: Upload 45-60 second audio sample → ElevenLabs voice clone
- **Acknowledgement Library**: Rotates through "Got it!", "Perfect, thanks!", etc. during conversation

**Conversation Configuration:**
- **Greeting Script**: Customizable opening message
- **Follow-up Questions**: Configurable per business type (general, trades, events, beauty)
- **AI Instructions**: Custom prompt modifications for business context
- **Business Context**: Uses business profile (services, hours, pricing, FAQs) for informed responses

**Transcription & Processing:**
- **Real-time STT**: Deepgram Voice Agent handles speech-to-text during call
- **LLM Processing**: Gemini (or OpenAI) processes conversation and extracts job details
- **Confidence Scoring**: AI provides confidence scores for manual review
- **Recording Storage**: Audio stored in Supabase with retention policies

#### Mode C: Voicemail Capture Only

**Call Flow:**
1. **Incoming Call**: Twilio answers call
2. **Voicemail Greeting**: Standard greeting ("Please leave a message after the tone")
3. **Recording**: Caller leaves voicemail (up to 5 minutes)
4. **Transcription**: Audio transcribed via Deepgram/Whisper
5. **Job Card Draft**: Transcript analyzed for job details (best-effort extraction)

**Use Cases:**
- Businesses who want minimal automation
- Fallback when IVR or AI is misconfigured
- Users who prefer manual voicemail review

### Technical Architecture:

#### Backend Components:
- **Twilio Integration**: Voice/SMS APIs for call routing, IVR, and messaging
- **IVR Handler** (`telephony/ivrHandler.js`): Generates TwiML for Mode A, handles DTMF input
- **SMS Link Sender** (`telephony/smsLinkSender.js`): Sends booking/quote links immediately during calls
- **Deepgram Voice Agent**: Real-time STT + LLM + TTS for Mode B (AI receptionist)
- **Supabase Database**: Users, business profiles, call events, IVR templates
- **Supabase Storage**: Audio recordings, voice profiles, greeting files
- **OpenAI/Gemini**: Entity extraction, job classification, response drafting

#### Key Services:
```
telephony/
├── ivrHandler.js              # Mode A: IVR TwiML generation + DTMF routing
├── smsLinkSender.js           # Mode A: Immediate SMS sending during call
├── deepgramVoiceAgent.js      # Mode B: AI receptionist WebSocket handler
└── realtimeServer.js          # WebSocket server for AI calls

src/
├── screens/
│   ├── CallsScreen.tsx                  # Mode selector UI (formerly ReceptionistScreen)
│   ├── calls/
│   │   ├── IVRScriptEditor.tsx         # Mode A: IVR script customization
│   │   ├── CallAnalyticsScreen.tsx     # Call metrics and diagnostics
│   │   └── CallSetupScreen.tsx         # Call forwarding setup wizard
│   ├── onboarding/
│   │   └── CallsSetupScreen.tsx        # Onboarding flow (formerly ReceptionistSetupScreen)
│   └── settings/
│       ├── BusinessProfileScreen.tsx    # Business context + link configuration
│       └── GreetingSetupScreen.tsx      # Mode B: Voice profile + greeting config
├── services/
│   ├── CallHandlingService.ts           # Mode management (formerly ReceptionistService)
│   ├── BusinessProfileService.ts        # Business context for all modes
│   ├── TwilioService.ts                # Phone provisioning
│   ├── BookingService.ts               # Booking page management
│   └── voicemail/
│       ├── pipeline.ts                  # Mode C: Voicemail processing
│       └── SupabaseVoicemailRepository.ts
└── types/
    ├── onboarding.ts                    # CallHandlingMode type
    └── businessProfile.ts               # BusinessProfile with IVR fields
```

#### Database Schema:
- **users**: `call_handling_mode` ('sms_links' | 'ai_receptionist' | 'voicemail_only')
- **business_profiles**: `booking_link_url`, `quote_link_url`, `ivr_custom_script`, `ivr_greeting_template`
- **ivr_templates**: Pre-built IVR script templates (professional, casual, trades, etc.)
- **call_events**: Comprehensive event log (DTMF presses, SMS sent, outcomes, analytics)
- **calls**: Call records with status, duration, transcription
- **voicemails**: Recording metadata, transcripts, confidence scores (Mode C)
- **voice_profiles**: Custom voice clones for Mode B
- **booking_pages**: Booking page configuration and calendar integration

### Setup Process:

#### Onboarding Wizard (New Flow):
1. **Website Scraping**: Enter business website URL → scrape services, tone, industry
2. **Call Handling Mode**: Default to Mode A (SMS Links), option to skip to Mode B or C
3. **Mode A Configuration** (Default):
   - Auto-generate booking page slug (`flynnbooking.com/business-slug`)
   - Auto-generate quote intake form URL
   - Auto-suggest IVR script based on website scraping
   - Enable/disable booking link, quote link
   - Preview IVR call flow
4. **Call Forwarding Setup**: Carrier-specific forwarding codes + step-by-step guide
5. **Verification**: Test call to confirm IVR + SMS sending works
6. **Optional Mode B Setup**: Voice profile selection, greeting script, follow-up questions (skippable)

#### Forwarding Codes (Examples):
- **Busy/No Answer**: `*004*[flynn_number]#` (varies by carrier)
- **Carrier-specific guides**: Verizon, AT&T, T-Mobile, Telstra, Optus, etc.

### Privacy & Compliance:
- **Recording consent**: IVR greeting includes disclosure message per regional requirements
- **Data retention**: Configurable retention windows (30/60/90 days)
- **Secure storage**: Encrypted audio files in Supabase
- **Audit logs**: Track all call events (DTMF, SMS, outcomes)
- **GDPR/privacy compliance**: Export and deletion capabilities
- **SMS opt-out**: All SMS include "Reply STOP to opt out" language

### Success Metrics (Mode-Specific):

**Mode A (SMS Links):**
- **Call capture rate**: % of missed calls answered by Flynn
- **DTMF engagement**: % of callers who press a digit
- **Booking requests**: Count of "Press 1" selections
- **Quote requests**: Count of "Press 2" selections
- **SMS delivery rate**: % of SMS sent successfully
- **Link click-through rate**: % of SMS recipients who clicked link
- **Booking conversion**: SMS → completed bookings
- **Quote conversion**: SMS → submitted quote forms

**Mode B (AI Receptionist):**
- **Conversation completion**: % of calls where AI gathered all required info
- **Entity extraction accuracy**: % of correctly extracted names, phones, dates
- **Follow-up approval rate**: % of drafted messages sent by user
- **Response time**: Median time from call to follow-up sent

**Mode C (Voicemail):**
- **Transcription accuracy**: Word error rate
- **Job card creation rate**: % of voicemails converted to jobs

### UI/UX Priorities:

**Calls Screen (Mode Selector):**
- **3-card layout**: SMS Links (default), AI Receptionist (premium), Voicemail Only
- **Mode-specific configuration**: Show relevant settings based on selected mode
- **Test functionality**: In-app test call simulator for each mode
- **Status indicators**: Green = configured, Yellow = misconfigured, Gray = not configured

**Mode A UI:**
- **IVR script editor**: Live preview, template library, placeholder autocomplete
- **Link configuration**: Toggle booking/quote, preview SMS content
- **Analytics dashboard**: DTMF breakdown, SMS delivery, link clicks, conversions

**Mode B UI:**
- **Voice profile selector**: Preview voice samples before selection
- **Greeting editor**: Record or upload greeting, test playback
- **Question builder**: Add/edit/reorder follow-up questions
- **Approval queue**: Review transcripts, approve/edit drafted responses

**Mode C UI:**
- **Voicemail list**: Show transcripts, confidence scores, caller info
- **Playback controls**: Audio player with transcript sync

## 🚫 Development Rules

### NEVER Run Development Servers
- **DO NOT** use `npm start`, `npm run dev`, `expo start`, or any similar commands
- **DO NOT** attempt to start development servers or preview environments
- The user will handle all server/preview management themselves
- Focus only on code implementation and file changes

### Why This Rule Exists
- Development servers are managed by the user in their local environment
- Starting servers can interfere with the user's existing development setup
- The app preview is handled separately by the user

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.