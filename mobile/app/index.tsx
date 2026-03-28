/**
 * ORBIT — Welcome screen
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function WelcomeScreen() {
  const logoScale = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const featuresOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const ringRotate = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withDelay(200, withTiming(1, { duration: 550, easing: Easing.out(Easing.back(1.4)) }));
    titleOpacity.value = withDelay(380, withTiming(1, { duration: 450 }));
    subtitleOpacity.value = withDelay(560, withTiming(1, { duration: 400 }));
    featuresOpacity.value = withDelay(740, withTiming(1, { duration: 400 }));
    buttonsOpacity.value = withDelay(920, withTiming(1, { duration: 400 }));

    pulseScale.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 1800 }), withTiming(1, { duration: 1800 })),
      -1,
      true
    );

    ringRotate.value = withRepeat(
      withTiming(1, { duration: 24000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value * pulseScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringRotate.value * 360}deg` }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: (1 - titleOpacity.value) * 24 }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: (1 - subtitleOpacity.value) * 16 }],
  }));

  const featuresStyle = useAnimatedStyle(() => ({
    opacity: featuresOpacity.value,
    transform: [{ translateY: (1 - featuresOpacity.value) * 16 }],
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
    transform: [{ translateY: (1 - buttonsOpacity.value) * 20 }],
  }));

  const features = [
    { icon: 'planet-outline' as const, text: 'Discover people in your orbit' },
    { icon: 'color-filter-outline' as const, text: 'Match on shared interests' },
    { icon: 'chatbubble-ellipses-outline' as const, text: 'Chat after you connect' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <LinearGradient
        colors={[Colors.background.primary, '#0a0f24', Colors.background.tertiary]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.ambientOrb, styles.orbTop]} />
      <View style={[styles.ambientOrb, styles.orbBottom]} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Animated.View style={[styles.orbitRing, ringStyle]} pointerEvents="none">
            <View style={styles.orbitRingInner} />
          </Animated.View>

          <Animated.View style={[styles.logoWrap, logoStyle]}>
            <LinearGradient
              colors={[Colors.primary.start, Colors.primary.end]}
              style={styles.logoGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="planet" size={44} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>

          <Animated.View style={[styles.wordmarkBlock, titleStyle]}>
            <View style={styles.wordmarkRow}>
              <Text style={styles.wordmarkOr}>OR</Text>
              <LinearGradient
                colors={[Colors.primary.light, Colors.primary.end]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.wordmarkBitBg}
              >
                <Text style={styles.wordmarkBit}>BIT</Text>
              </LinearGradient>
            </View>
            <View style={styles.taglinePill}>
              <View style={styles.taglineDot} />
              <Text style={styles.tagline}>Your circle, nearby</Text>
            </View>
          </Animated.View>

          <Animated.Text style={[styles.subtitle, subtitleStyle]}>
            Meet people who care about the same things you do — then chat when the vibe is mutual.
          </Animated.Text>

          <Animated.View style={[styles.features, featuresStyle]}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <LinearGradient
                  colors={[`${Colors.primary.default}33`, `${Colors.primary.end}22`]}
                  style={styles.featureIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name={feature.icon} size={22} color={Colors.primary.light} />
                </LinearGradient>
                <Text style={styles.featureText}>{feature.text}</Text>
              </View>
            ))}
          </Animated.View>
        </View>

        <Animated.View style={[styles.buttons, buttonsStyle]}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.primary.start, Colors.primary.end]}
              style={styles.primaryButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.primaryButtonText}>Get started</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.75}
          >
            <Text style={styles.secondaryButtonText}>Sign in</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  ambientOrb: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 0.85,
    borderRadius: SCREEN_WIDTH * 0.425,
    opacity: 0.35,
  },
  orbTop: {
    top: -SCREEN_WIDTH * 0.35,
    right: -SCREEN_WIDTH * 0.2,
    backgroundColor: Colors.primary.dark,
  },
  orbBottom: {
    bottom: -SCREEN_WIDTH * 0.4,
    left: -SCREEN_WIDTH * 0.25,
    backgroundColor: '#134e4a',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  orbitRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    top: '22%',
  },
  orbitRingInner: {
    width: 188,
    height: 188,
    borderRadius: 94,
    borderWidth: 1,
    borderColor: `${Colors.primary.default}44`,
  },
  logoWrap: {
    marginBottom: Spacing.xl,
    zIndex: 1,
  },
  logoGradient: {
    width: 100,
    height: 100,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary.default,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },
  wordmarkBlock: {
    alignItems: 'center',
    marginBottom: Spacing.md,
    zIndex: 1,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkOr: {
    fontSize: 46,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: 2,
  },
  wordmarkBitBg: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 2,
  },
  wordmarkBit: {
    fontSize: 46,
    fontWeight: '800',
    color: '#0B1120',
    letterSpacing: 2,
  },
  taglinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.glass.background,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  taglineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary.end,
    marginRight: Spacing.sm,
  },
  tagline: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.text.accent,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xxl,
    paddingHorizontal: Spacing.md,
    maxWidth: 340,
  },
  features: {
    width: '100%',
    maxWidth: 340,
    gap: Spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  featureText: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    fontWeight: FontWeights.medium,
    lineHeight: 22,
  },
  buttons: {
    width: '100%',
    gap: Spacing.sm,
  },
  primaryButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: Colors.primary.default,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    letterSpacing: 0.3,
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Colors.text.primary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
});
