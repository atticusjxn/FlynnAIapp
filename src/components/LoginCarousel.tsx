import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    FlatList,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    withSequence,
    withDelay,
    withRepeat,
    Easing,
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';
import { FlynnIcon } from './ui/FlynnIcon';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

const { width } = Dimensions.get('window');

// --- Animated Components ---

const ReceptionistAnimation = ({ isActive }: { isActive: boolean }) => {
    const phoneShake = useSharedValue(0);
    const badgeScale = useSharedValue(0);
    const bubbleOpacity = useSharedValue(0);

    useEffect(() => {
        if (isActive) {
            // Reset
            phoneShake.value = 0;
            badgeScale.value = 0;
            bubbleOpacity.value = 0;

            // Sequence
            phoneShake.value = withDelay(500, withRepeat(withSequence(
                withTiming(-10, { duration: 50 }),
                withTiming(10, { duration: 50 }),
                withTiming(0, { duration: 50 })
            ), 6, true));

            badgeScale.value = withDelay(1500, withSpring(1));
            bubbleOpacity.value = withDelay(2000, withTiming(1));
        }
    }, [isActive]);

    const phoneStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${phoneShake.value}deg` }],
    }));

    const badgeStyle = useAnimatedStyle(() => ({
        transform: [{ scale: badgeScale.value }],
    }));

    const bubbleStyle = useAnimatedStyle(() => ({
        opacity: bubbleOpacity.value,
        transform: [{ translateY: withTiming(bubbleOpacity.value === 1 ? 0 : 10) }],
    }));

    return (
        <View style={styles.animationContainer}>
            <Animated.View style={[styles.phoneIcon, phoneStyle]}>
                <FlynnIcon name="call" size={48} color={colors.white} />
            </Animated.View>

            <Animated.View style={[styles.badge, badgeStyle]}>
                <Text style={styles.badgeText}>AI</Text>
            </Animated.View>

            <Animated.View style={[styles.speechBubble, bubbleStyle]}>
                <Text style={styles.speechText}>Hi! Flynn here. I can take a message.</Text>
            </Animated.View>
        </View>
    );
};

const WaveBar = ({ delay, isActive }: { delay: number; isActive: boolean }) => {
    const scale = useSharedValue(1);

    useEffect(() => {
        if (isActive) {
            scale.value = 1;
            scale.value = withDelay(
                delay,
                withRepeat(
                    withSequence(
                        withTiming(1.5, { duration: 500 }),
                        withTiming(1, { duration: 500 })
                    ),
                    4,
                    true
                )
            );
        }
    }, [isActive, delay]);

    const style = useAnimatedStyle(() => ({
        transform: [{ scaleY: scale.value }],
    }));

    return <Animated.View style={[styles.waveBar, style, { height: 20 + Math.random() * 20 }]} />;
};

const JobCreationAnimation = ({ isActive }: { isActive: boolean }) => {
    const cardTranslateY = useSharedValue(50);
    const cardOpacity = useSharedValue(0);
    const waveOpacity = useSharedValue(1);

    useEffect(() => {
        if (isActive) {
            // Reset
            cardTranslateY.value = 50;
            cardOpacity.value = 0;
            waveOpacity.value = 1;

            // Transition to card
            waveOpacity.value = withDelay(2000, withTiming(0));
            cardTranslateY.value = withDelay(2200, withSpring(0));
            cardOpacity.value = withDelay(2200, withTiming(1));
        }
    }, [isActive]);

    const waveContainerStyle = useAnimatedStyle(() => ({
        opacity: waveOpacity.value,
    }));

    const cardStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: cardTranslateY.value }],
        opacity: cardOpacity.value,
    }));

    return (
        <View style={styles.animationContainer}>
            <Animated.View style={[styles.waveformContainer, waveContainerStyle]}>
                {[1, 2, 3, 4, 5].map((i) => (
                    <WaveBar key={i} delay={i * 100} isActive={isActive} />
                ))}
            </Animated.View>

            <Animated.View style={[styles.jobCard, cardStyle]}>
                <View style={styles.jobCardHeader}>
                    <View style={styles.jobIcon}>
                        <FlynnIcon name="construct" size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.jobTitle}>New Lead: Plumbing</Text>
                </View>
                <Text style={styles.jobDetail}>Client: Sarah J.</Text>
                <Text style={styles.jobDetail}>"Leaking tap in kitchen..."</Text>
            </Animated.View>
        </View>
    );
};

const FollowUpAnimation = ({ isActive }: { isActive: boolean }) => {
    const msg1X = useSharedValue(-50);
    const msg1Opacity = useSharedValue(0);
    const msg2X = useSharedValue(50);
    const msg2Opacity = useSharedValue(0);

    useEffect(() => {
        if (isActive) {
            // Reset
            msg1X.value = -50;
            msg1Opacity.value = 0;
            msg2X.value = 50;
            msg2Opacity.value = 0;

            // Sequence
            msg1X.value = withDelay(500, withSpring(0));
            msg1Opacity.value = withDelay(500, withTiming(1));

            msg2X.value = withDelay(1500, withSpring(0));
            msg2Opacity.value = withDelay(1500, withTiming(1));
        }
    }, [isActive]);

    const msg1Style = useAnimatedStyle(() => ({
        transform: [{ translateX: msg1X.value }],
        opacity: msg1Opacity.value,
    }));

    const msg2Style = useAnimatedStyle(() => ({
        transform: [{ translateX: msg2X.value }],
        opacity: msg2Opacity.value,
    }));

    return (
        <View style={styles.animationContainer}>
            <Animated.View style={[styles.messageBubble, styles.messageLeft, msg1Style]}>
                <Text style={styles.messageText}>I need a quote for a job.</Text>
            </Animated.View>

            <Animated.View style={[styles.messageBubble, styles.messageRight, msg2Style]}>
                <Text style={[styles.messageText, styles.messageTextRight]}>
                    Thanks! Here's a link to book a time: flynn.ai/book
                </Text>
            </Animated.View>
        </View>
    );
};

// --- Main Component ---

interface Slide {
    id: string;
    title: string;
    description: string;
    component: (isActive: boolean) => React.ReactNode;
}

const SLIDES: Slide[] = [
    {
        id: '1',
        title: '24/7 AI Receptionist',
        description: 'Never miss a lead. Flynn answers calls and takes messages 24/7.',
        component: (isActive) => <ReceptionistAnimation isActive={isActive} />,
    },
    {
        id: '2',
        title: 'Instant Transcription',
        description: 'Read your voicemails. AI extracts client details and job info instantly.',
        component: (isActive) => <JobCreationAnimation isActive={isActive} />,
    },
    {
        id: '3',
        title: 'Automated Follow-up',
        description: 'Reply to leads automatically. Turn missed calls into booked jobs.',
        component: (isActive) => <FollowUpAnimation isActive={isActive} />,
    },
];

export const LoginCarousel = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    // Auto-play logic
    useEffect(() => {
        const interval = setInterval(() => {
            let nextIndex = currentIndex + 1;
            if (nextIndex >= SLIDES.length) {
                nextIndex = 0;
            }
            flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
            setCurrentIndex(nextIndex);
        }, 6000); // Longer duration for animations to play out

        return () => clearInterval(interval);
    }, [currentIndex]);

    const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const contentOffsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffsetX / width);
        if (index !== currentIndex) {
            setCurrentIndex(index);
        }
    };

    const renderItem = ({ item, index }: { item: Slide; index: number }) => (
        <View style={styles.slide}>
            <View style={styles.visualContainer}>
                {item.component(index === currentIndex)}
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                bounces={false}
            />
            <View style={styles.pagination}>
                {SLIDES.map((_, index) => (
                    <View
                        key={index}
                        style={[
                            styles.dot,
                            index === currentIndex ? styles.activeDot : styles.inactiveDot,
                        ]}
                    />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.white,
        borderBottomWidth: 2,
        borderBottomColor: colors.black,
    },
    slide: {
        width,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
    },
    visualContainer: {
        width: 280,
        height: 180,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
        // backgroundColor: colors.gray50, // Optional: background for the visual area
        // borderRadius: borderRadius.lg,
    },
    animationContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
    },
    // Slide 1 Styles
    phoneIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.black,
        ...shadows.md,
    },
    badge: {
        position: 'absolute',
        top: 30,
        right: 80,
        backgroundColor: colors.warning,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.black,
        zIndex: 10,
    },
    badgeText: {
        ...typography.caption,
        fontWeight: 'bold',
        color: colors.black,
    },
    speechBubble: {
        position: 'absolute',
        bottom: 10,
        backgroundColor: colors.white,
        padding: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.black,
        borderBottomLeftRadius: 0,
        ...shadows.sm,
    },
    speechText: {
        ...typography.bodySmall,
        color: colors.textPrimary,
    },
    // Slide 2 Styles
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 60,
        gap: 6,
        position: 'absolute',
    },
    waveBar: {
        width: 8,
        backgroundColor: colors.primary,
        borderRadius: 4,
    },
    jobCard: {
        width: 220,
        backgroundColor: colors.white,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 2,
        borderColor: colors.black,
        ...shadows.md,
    },
    jobCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    jobIcon: {
        marginRight: spacing.xs,
    },
    jobTitle: {
        ...typography.h4,
        fontSize: 14,
    },
    jobDetail: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    // Slide 3 Styles
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: colors.black,
        ...shadows.xs,
    },
    messageLeft: {
        alignSelf: 'flex-start',
        backgroundColor: colors.gray100,
        borderBottomLeftRadius: 0,
        marginLeft: 20,
    },
    messageRight: {
        alignSelf: 'flex-end',
        backgroundColor: colors.primary,
        borderBottomRightRadius: 0,
        marginRight: 20,
    },
    messageText: {
        ...typography.bodySmall,
        color: colors.textPrimary,
    },
    messageTextRight: {
        color: colors.white,
    },
    // Common
    title: {
        ...typography.h2,
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    description: {
        ...typography.bodyLarge,
        color: colors.textSecondary,
        textAlign: 'center',
        maxWidth: '80%',
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        bottom: spacing.lg,
        width: '100%',
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginHorizontal: spacing.xs,
        borderWidth: 1,
        borderColor: colors.black,
    },
    activeDot: {
        backgroundColor: colors.primary,
        width: 12,
        height: 12,
    },
    inactiveDot: {
        backgroundColor: colors.white,
    },
});
