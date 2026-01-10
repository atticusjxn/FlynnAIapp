/**
 * Equalizer Animation Component
 *
 * Displays animated bars that react to audio, providing visual feedback
 * when the AI receptionist is speaking
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface EqualizerAnimationProps {
  isActive: boolean; // Whether the equalizer should be animating
  barCount?: number; // Number of bars to display
  barColor?: string; // Color of the bars
  height?: number; // Total height of the equalizer
  audioLevel?: number; // Real-time audio level (0-1)
}

const EqualizerAnimation: React.FC<EqualizerAnimationProps> = ({
  isActive,
  barCount = 5,
  barColor = '#2563EB', // Flynn brand primary blue
  height = 60,
  audioLevel = 0,
}) => {
  // Create animated values for each bar
  const barAnimations = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(0.2))
  ).current;
  
  // Random multipliers for each bar to create variety in height
  const multipliers = useRef(
    Array.from({ length: barCount }, () => 0.4 + Math.random() * 0.6)
  ).current;

  useEffect(() => {
    if (isActive) {
      // Drive animations based on audioLevel if provided, otherwise fallback to random
      barAnimations.forEach((anim, index) => {
        const targetValue = audioLevel > 0 
          ? Math.max(0.1, audioLevel * multipliers[index])
          : 0.1 + Math.random() * 0.2;

        Animated.timing(anim, {
          toValue: targetValue,
          duration: 80, // Fast response for real-time feel
          useNativeDriver: false,
        }).start();
      });
    } else {
      // Reset all bars to minimum height when inactive
      barAnimations.forEach(anim => {
        Animated.timing(anim, {
          toValue: 0.1,
          duration: 300,
          useNativeDriver: false,
        }).start();
      });
    }
  }, [isActive, audioLevel, barAnimations, multipliers]);

  return (
    <View style={styles.container}>
      {barAnimations.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              height: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [height * 0.2, height],
              }),
              backgroundColor: barColor,
              opacity: isActive ? 1 : 0.3,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  bar: {
    width: 6,
    borderRadius: 3,
    alignSelf: 'center',
  },
});

export default EqualizerAnimation;
