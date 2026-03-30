/**
 * ORBIT — Welcome. Navy icon inspired: deep indigo mark, gold accent dot.
 */

import React, { useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { FontSizes, Spacing, BorderRadius } from '../constants/Colors';
import { useOrbitTheme } from '../src/theme';
import { AppText } from '../src/ui/AppText';

export default function WelcomeScreen() {
  const { colors, resolvedScheme } = useOrbitTheme();
  const isDark = resolvedScheme === 'dark';
  const insets = useSafeAreaInsets();

  const fadeIn = useSharedValue(0);
  const btnIn = useSharedValue(0);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    fadeIn.value = withDelay(100, withTiming(1, { duration: 600, easing: ease }));
    btnIn.value = withDelay(400, withTiming(1, { duration: 500, easing: ease }));
  }, []);

  const aFade = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
    transform: [{ translateY: (1 - fadeIn.value) * 20 }],
  }));

  const aBtn = useAnimatedStyle(() => ({
    opacity: btnIn.value,
    transform: [{ translateY: (1 - btnIn.value) * 16 }],
  }));

  const GOLD = colors.secondary.default;
  const RING_SIZE = 52;
  const RING_BORDER = 4;
  const DOT_SIZE = 12;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: colors.background.primary,
        },
        safe: {
          flex: 1,
          paddingHorizontal: Spacing.lg,
          paddingTop: Platform.OS === 'android' ? insets.top + Spacing.md : 0,
        },
        center: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        iconWrap: {
          width: 88,
          height: 88,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: Spacing.xl,
        },
        orbitRing: {
          width: RING_SIZE,
          height: RING_SIZE,
          borderRadius: RING_SIZE / 2,
          borderWidth: RING_BORDER,
          borderColor: '#FFFFFF',
          position: 'relative',
        },
        goldDot: {
          position: 'absolute',
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: DOT_SIZE / 2,
          backgroundColor: GOLD,
          top: -DOT_SIZE / 2 + RING_BORDER / 2,
          right: 2,
        },
        goldDot2: {
          position: 'absolute',
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: DOT_SIZE / 2,
          backgroundColor: GOLD,
          bottom: -DOT_SIZE / 2 + RING_BORDER / 2,
          left: 2,
        },
        headline: {
          fontSize: 32,
          fontWeight: '700',
          letterSpacing: -0.8,
          lineHeight: 38,
          color: colors.text.primary,
          textAlign: 'center',
        },
        sub: {
          marginTop: Spacing.md,
          fontSize: FontSizes.md,
          lineHeight: 24,
          color: colors.text.secondary,
          textAlign: 'center',
          maxWidth: 300,
        },
        footer: {
          paddingBottom: Math.max(insets.bottom, Spacing.lg),
          gap: Spacing.sm,
        },
        primaryCta: {
          borderRadius: BorderRadius.lg,
          overflow: 'hidden',
        },
        primaryInner: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 16,
          gap: Spacing.sm,
        },
        primaryLabel: {
          color: '#FFFFFF',
          fontSize: FontSizes.md,
          fontWeight: '600',
        },
        secondaryCta: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 14,
        },
        secondaryLabel: {
          fontSize: FontSizes.sm,
          fontWeight: '500',
          color: colors.text.tertiary,
        },
      }),
    [colors, insets, isDark, GOLD]
  );

  return (
    <View style={styles.root}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.safe}>
        <View style={styles.center}>
          <Animated.View style={aFade}>
            <View style={{ alignItems: 'center' }}>
              {/* Navy icon mark — indigo square, white orbit ring, gold dots */}
              <LinearGradient
                colors={isDark ? ['#1A1650', '#0E0C30'] : [colors.primary.start, colors.primary.end]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconWrap}
              >
                <View style={styles.orbitRing}>
                  <View style={styles.goldDot} />
                  <View style={styles.goldDot2} />
                </View>
              </LinearGradient>

              <AppText style={styles.headline}>Find your people,{'\n'}nearby.</AppText>
              <AppText style={styles.sub}>
                Connect with people who share your interests. Chat when it feels right.
              </AppText>
            </View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.footer, aBtn]}>
          <TouchableOpacity
            style={styles.primaryCta}
            onPress={() => router.push('/(auth)/register')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[colors.primary.start, colors.primary.end]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryInner}
            >
              <AppText style={styles.primaryLabel}>Get started</AppText>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryCta}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.7}
          >
            <AppText style={styles.secondaryLabel}>Already have an account? Sign in</AppText>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}
