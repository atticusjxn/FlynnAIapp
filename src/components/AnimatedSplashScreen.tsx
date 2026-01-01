
import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import Animated, {
    useAnimatedProps,
    useSharedValue,
    withTiming,
    withDelay,
    withSequence,
    runOnJS,
    Easing,
    interpolateColor,
    useAnimatedStyle,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// SVG Paths from assets/images/adaptive-icon.svg
// Path 1: Main 'F' Body
const PATH_F_BODY = "M0 0 C116.82 0 233.64 0 354 0 C354 32.34 354 64.68 354 98 C273.81 98 193.62 98 111 98 C111 106.58 111 115.16 111 124 C170.07 124 229.14 124 290 124 C290 156.01 290 188.02 290 221 C230.93 221 171.86 221 111 221 C111 227.93 111 234.86 111 242 C74.37 242 37.74 242 0 242 C0 162.14 0 82.28 0 0 Z";
// Path 2: Orange Dot/Bottom
const PATH_F_DOT = "M0 0 C36.3 0 72.6 0 110 0 C110 28.38 110 56.76 110 86 C73.7 86 37.4 86 0 86 C0 57.62 0 29.24 0 0 Z";

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface Props {
    onAnimationFinish: () => void;
    isAppReady: boolean;
}

const AnimatedSplashScreen: React.FC<Props> = ({ onAnimationFinish, isAppReady }) => {
    // Shared values for animation state
    const progress = useSharedValue(0);
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    // Approximate lengths for stroke animation
    const LEN_BODY = 1500;
    const LEN_DOT = 500;

    useEffect(() => {
        // Sequence:
        // 1. Draw strokes (0 -> 1)
        // 2. Fill (via opacity/color transition in props) - implicit by progress finishing
        // 3. Wait for app ready
        // 4. Exit animation

        progress.value = withTiming(1, {
            duration: 2000,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }, (finished) => {
            if (finished && isAppReady) {
                // Trigger exit if app is ready immediately after drawing
                // If not ready, we wait for the useEffect dependency on isAppReady
            }
        });
    }, []);

    // Watch for App Ready to trigger exit
    useEffect(() => {
        if (isAppReady && progress.value === 1) {
            startExitAnimation();
        }
    }, [isAppReady]);

    // Also check periodically or via a reaction if the animation finished BUT app wasn't ready then, and now it is?
    // The previous useEffect covers "isAppReady changes". 
    // We need to cover "Animation finishes after app is already ready".
    // We can do this by checking inside the callback or using a reaction. 
    // For simplicity, let's use a timeout/check in the first effect. 
    // Actually, simpler: Let's assume the drawing takes 2s. If app loads faster, we wait.
    // If app loads slower, we sit at full logo until ready.

    // Let's refine the logic:
    // When progress finishes, we check isAppReady. If yes, exit. 
    // If isAppReady becomes true, we check if progress finished. If yes, exit.

    // Helper to check and exit
    const startExitAnimation = () => {
        scale.value = withTiming(50, { duration: 800, easing: Easing.ease });
        opacity.value = withTiming(0, { duration: 600, easing: Easing.ease }, () => {
            runOnJS(onAnimationFinish)();
        });
    };

    // We can use a reaction to sharedValue, or just simple state in JS
    // Since we are inside a component, let's trust React useEffects + callback
    useEffect(() => {
        // This effect runs when isAppReady changes.
        // If app becomes ready, we verify if animation is done (progress.value approx 1).
        // However, reading sharedValue in useEffect is synchronous.
        // A more robust way in Reanimated is useDerivedValue or runOnJS, but simpler:
        // Just force a check after animation duration if we want to be safe, 
        // OR, simply rely on the fact that if we are here, we want to exit as soon as BOTH are true.

        if (isAppReady) {
            // If manual check says we are done (we can't easily check shared value synchronously safely in all versions)
            // Let's just trigger a small delay if we think we might be racing, 
            // but visually it's fine to wait for the drawing to finish.

            // The callback in withTiming above handles the "Animation finishes second" case.
            // This effect handles the "App Ready finishes second" case.

            // But we need to know if animation is done.
            // Let's use a JS state for "animationDone".
        }
    }, [isAppReady]);


    const [animationFinished, setAnimationFinished] = React.useState(false);

    // Re-run the initial animation with JS state update
    useEffect(() => {
        progress.value = withTiming(1, {
            duration: 2000,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }, (finished) => {
            if (finished) {
                runOnJS(setAnimationFinished)(true);
            }
        });
    }, []);

    useEffect(() => {
        if (animationFinished && isAppReady) {
            startExitAnimation();
        }
    }, [animationFinished, isAppReady]);


    const animatedPropsBody = useAnimatedProps(() => {
        const strokeDashoffset = interpolateColor(
            progress.value,
            [0, 1],
            [LEN_BODY, 0]
        );
        // Determine fill opacity: 0 until almost done, then fade in
        const fillOpacity = progress.value > 0.8 ? (progress.value - 0.8) * 5 : 0;

        return {
            strokeDashoffset: LEN_BODY * (1 - progress.value),
            fillOpacity: fillOpacity,
            strokeOpacity: 1 - fillOpacity, // Fade out stroke as fill comes in? Or keep both. detailed: keep stroke or fade it.
            // Let's keep stroke or make it part of the fill.
        };
    });

    const animatedPropsDot = useAnimatedProps(() => {
        const fillOpacity = progress.value > 0.8 ? (progress.value - 0.8) * 5 : 0;
        return {
            strokeDashoffset: LEN_DOT * (1 - progress.value),
            fillOpacity: fillOpacity,
        };
    });

    const containerStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
            opacity: opacity.value
        };
    });

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.centered, containerStyle]}>
                <Svg width={300} height={300} viewBox="0 0 500 500">
                    {/* Center the logo in the 500x500 box. 
               Original SVG was 500x500.
               Path 2 translate(82, 75).
               Path 3 translate(83, 339).
           */}
                    <G>
                        {/* Main Body F */}
                        <AnimatedPath
                            d={PATH_F_BODY}
                            transform="translate(82, 75)"
                            stroke="#2E2F30"
                            strokeWidth={5}
                            fill="#2E2F30"
                            strokeDasharray={[LEN_BODY, LEN_BODY]}
                            animatedProps={animatedPropsBody}
                        />
                        {/* Orange Dot */}
                        <AnimatedPath
                            d={PATH_F_DOT}
                            transform="translate(83, 339)"
                            stroke="#FE5A12"
                            strokeWidth={5}
                            fill="#FE5A12"
                            strokeDasharray={[LEN_DOT, LEN_DOT]}
                            animatedProps={animatedPropsDot}
                        />
                    </G>
                </Svg>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#ffffff', // Match splash background
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
    },
    centered: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default AnimatedSplashScreen;
