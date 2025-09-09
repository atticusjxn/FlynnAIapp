# Flynn AI Design System & Project Context

## About Flynn AI
Flynn AI is a mobile app for busy service providers (plumbers, electricians, cleaners, contractors, consultants, agencies) that automatically captures job details from screenshots and phone calls to create calendar events/job cards and send client confirmations.

### Core Features:
- **Screenshot upload**: Users upload screenshots of text conversations → AI extracts job details → creates job cards/calendar events
- **Call recording**: Call forwarding with press-0 to record → AI processes recordings → creates job cards
- **Job confirmations**: Automatically send SMS confirmations to clients
- **Calendar integration**: Google Calendar, Outlook, Apple Calendar sync

### Target Users:
Busy sole traders and small service businesses who get scheduling requests via calls and texts. They need quick, reliable ways to capture job details without manual data entry.

### App Navigation (Current):
5 tabs: Dashboard (home), Jobs, Calendar, Clients, Settings

## 🎨 Design System Overview

FlynnAI uses React Native's built-in StyleSheet API as the foundation for all UI components. This document outlines the design rules, patterns, and best practices for maintaining consistency across the application.

### Brand Personality:
- **Professional and trustworthy** - Users need to feel confident in the app
- **Efficient and time-saving** - Every interaction should feel fast and purposeful
- **Clean and uncluttered** - Avoid visual noise, focus on core tasks
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
- Use **"job"** or **"event"** instead of technical terms
- Say **"Send confirmation"** not "Execute API call"
- Use **"Upload screenshot"** not "Process image data"
- Keep copy concise - users are busy and on-the-go

### Voice & Tone:
- **Professional but approachable** - Like a reliable assistant
- **Action-oriented** - "Create job", "Send confirmation", "View details"
- **Encouraging** - "Great! Your job has been created"
- **Clear status updates** - "Processing...", "Sent successfully", "Failed to send"

### Button Labels:
- ✅ "Create Job" (not "Submit")
- ✅ "Send Confirmation" (not "Execute")
- ✅ "View Details" (not "Open")
- ✅ "Upload Screenshot" (not "Select Image")

### Status Messages:
- ✅ "Job created successfully"
- ✅ "Confirmation sent to client"
- ✅ "Screenshot processed"
- ❌ "API call completed"
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
- **Dashboard**: Quick overview of pending jobs, recent activity, key metrics
- **Job Cards**: Substantial, tappable cards with clear status indicators
- **Action Buttons**: Large, prominent buttons for primary actions
- **Status Feedback**: Clear, immediate feedback for all user actions
- **Error Handling**: Gentle, helpful error messages with next steps

## 🔄 Version History

- **v1.0.0** - Initial design system implementation
- Last updated: December 2024
- Maintained by: FlynnAI Development Team

---

**Note**: This design system should be the single source of truth for all UI decisions in the FlynnAI application. Any deviations should be discussed and documented.