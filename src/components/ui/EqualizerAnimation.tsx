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
}

const EqualizerAnimation: React.FC<EqualizerAnimationProps> = ({
  isActive,
  barCount = 5,
  barColor = '#2563EB', // Flynn brand primary blue
  height = 60,
}) => {
  // Create animated values for each bar
  const barAnimations = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(0.2))
  ).current;

  useEffect(() => {
    if (isActive) {
      // Start animations for all bars
      const animations = barAnimations.map((anim, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.random() * 0.6 + 0.4, // Random height between 0.4 and 1.0
              duration: 150 + Math.random() * 200, // Random duration for variety
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: Math.random() * 0.4 + 0.2, // Random low height
              duration: 150 + Math.random() * 200,
              useNativeDriver: false,
            }),
          ])
        );
      });

      // Start all animations with slight delays for wave effect
      animations.forEach((animation, index) => {
        setTimeout(() => {
          animation.start();
        }, index * 50);
      });

      // Cleanup function to stop animations
      return () => {
        animations.forEach(animation => animation.stop());
      };
    } else {
      // Reset all bars to minimum height when inactive
      barAnimations.forEach(anim => {
        Animated.timing(anim, {
          toValue: 0.2,
          duration: 200,
          useNativeDriver: false,
        }).start();
      });
    }
  }, [isActive, barAnimations]);

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
