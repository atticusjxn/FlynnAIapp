import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, { Rect, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface AuroraBorderProps {
  width: number;
  height: number;
  borderRadius?: number;
  borderWidth?: number;
  gradientColors?: string[];
  animationDuration?: number;
  children?: React.ReactNode;
}

export const AuroraBorder: React.FC<AuroraBorderProps> = ({
  width,
  height,
  borderRadius = 12,
  borderWidth = 3,
  gradientColors = [
    '#60A5FA', // Blue
    '#A78BFA', // Purple
    '#F472B6', // Pink
    '#FB923C', // Orange
  ],
  animationDuration = 3000,
  children,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  // Calculate perimeter for stroke dash animation
  const perimeter = 2 * (width + height - 4 * borderRadius) + 2 * Math.PI * borderRadius;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: animationDuration,
        useNativeDriver: false,
      })
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [animationDuration]);

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -perimeter],
  });

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg
        width={width}
        height={height}
        style={styles.svgContainer}
      >
        <Defs>
          <SvgLinearGradient id="borderGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={gradientColors[0]} stopOpacity="0" />
            <Stop offset="5%" stopColor={gradientColors[0]} stopOpacity="0.1" />
            <Stop offset="10%" stopColor={gradientColors[1]} stopOpacity="0.2" />
            <Stop offset="20%" stopColor={gradientColors[1]} stopOpacity="0.4" />
            <Stop offset="40%" stopColor={gradientColors[2]} stopOpacity="0.7" />
            <Stop offset="60%" stopColor={gradientColors[2]} stopOpacity="0.9" />
            <Stop offset="80%" stopColor={gradientColors[3]} stopOpacity="1" />
            <Stop offset="100%" stopColor={gradientColors[3]} stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        <AnimatedRect
          x={borderWidth / 2}
          y={borderWidth / 2}
          width={width - borderWidth}
          height={height - borderWidth}
          rx={borderRadius}
          ry={borderRadius}
          stroke="url(#borderGradient)"
          strokeWidth={borderWidth}
          fill="transparent"
          strokeDasharray={`${perimeter * 0.75} ${perimeter * 0.25}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      {children && (
        <View 
          style={[
            styles.content, 
            { 
              width: width - borderWidth * 2,
              height: height - borderWidth * 2,
              borderRadius: Math.max(0, borderRadius - borderWidth),
              top: borderWidth,
              left: borderWidth,
            }
          ]}
        >
          {children}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  svgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  content: {
    position: 'absolute',
    overflow: 'hidden',
  },
});