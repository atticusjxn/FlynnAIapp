# FlynnAI Design System & Development Guidelines

## 🎨 Design System Overview

FlynnAI uses React Native's built-in StyleSheet API as the foundation for all UI components. This document outlines the design rules, patterns, and best practices for maintaining consistency across the application.

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

- **Primary (#2563EB)**: Main CTAs, primary buttons, active states, links
- **Secondary (#64748B)**: Secondary text, less important information
- **Success (#10B981)**: Success messages, completed states, positive actions
- **Warning (#F59E0B)**: Warning messages, caution states
- **Error (#EF4444)**: Error messages, destructive actions, validation errors
- **Grays**: Background layers, borders, disabled states, text hierarchy

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

## 📋 Component Checklist

When creating new components:

- [ ] Use StyleSheet.create() for all styles
- [ ] Follow color palette strictly
- [ ] Apply consistent spacing using the spacing system
- [ ] Include pressed/disabled states for interactive elements
- [ ] Add proper shadows for elevated components
- [ ] Test on both iOS and Android
- [ ] Ensure accessibility (min touch target 44x44)
- [ ] Document component props with TypeScript
- [ ] Create reusable variants (primary, secondary, etc.)
- [ ] Follow naming conventions (FlynnComponentName)

## 🚀 Usage Example

```javascript
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors, spacing, typography } from '../theme';

const FlynnJobCard = ({ job, onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{job.title}</Text>
        <View style={[styles.badge, styles[`badge${job.status}`]]}>
          <Text style={styles.badgeText}>{job.status}</Text>
        </View>
      </View>
      
      <Text style={styles.description}>{job.description}</Text>
      
      <View style={styles.footer}>
        <Text style={styles.date}>{job.date}</Text>
        <Text style={styles.client}>{job.clientName}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h4,
    color: colors.gray800,
    flex: 1,
  },
  badge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: 12,
  },
  badgePending: {
    backgroundColor: colors.warningLight,
  },
  badgeCompleted: {
    backgroundColor: colors.successLight,
  },
  badgeText: {
    ...typography.caption,
    color: colors.gray700,
  },
  description: {
    ...typography.bodyMedium,
    color: colors.gray600,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  date: {
    ...typography.caption,
    color: colors.gray500,
  },
  client: {
    ...typography.caption,
    color: colors.primary,
  },
});

export default FlynnJobCard;
```

## 🔄 Version History

- **v1.0.0** - Initial design system implementation
- Last updated: December 2024
- Maintained by: FlynnAI Development Team

---

**Note**: This design system should be the single source of truth for all UI decisions in the FlynnAI application. Any deviations should be discussed and documented.