import React from 'react';
import { View, StyleSheet } from 'react-native';

// Fallback component for production that doesn't use SVG
interface SafeAuroraBorderProps {
  width: number;
  height: number;
  borderRadius?: number;
  borderWidth?: number;
  gradientColors?: string[];
  animationDuration?: number;
  children?: React.ReactNode;
}

export const SafeAuroraBorder: React.FC<SafeAuroraBorderProps> = ({
  width,
  height,
  borderRadius = 12,
  borderWidth = 3,
  gradientColors = ['#60A5FA', '#A78BFA', '#F472B6', '#FB923C'],
  // animationDuration is accepted for API compatibility with the SVG version
  animationDuration,
  children,
}) => {
  // Simple fallback with animated border using regular View
  return (
    <View 
      style={[
        styles.container, 
        { 
          width, 
          height,
          borderRadius,
          borderWidth,
          borderColor: gradientColors[0],
        }
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderStyle: 'solid',
    overflow: 'hidden',
  },
});

// Conditionally export the SVG version in development, fallback in production
let AuroraBorderExport = SafeAuroraBorder;

if (__DEV__) {
  try {
    // Only try to load the SVG version in development
    const { AuroraBorder } = require('./AuroraBorder');
    AuroraBorderExport = AuroraBorder;
  } catch (error) {
    console.log('[SafeAuroraBorder] Using fallback, SVG version not available');
  }
}

export const AuroraBorder = AuroraBorderExport;
