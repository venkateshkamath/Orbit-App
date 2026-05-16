/**
 * ORBIT — Welcome screen.
 * Full-bleed gradient, no card. Content flows on the background.
 * Both themes use a deep, rich palette so the screen feels premium.
 */

import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../constants/Colors';
import { useOrbitTheme } from '../src/theme';
import { AppText } from '../src/ui/AppText';

export default function WelcomeScreen() {
  const { colors, fonts } = useOrbitTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();

  const accent = colors.primary.dark;
  const RING = 52;
  const BORDER = 3.5;
  const DOT = 11;

  const s = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background.primary },

        safe: {
          flex: 1,
          paddingHorizontal: 32,
          paddingTop: Math.max(insets.top, 16) + 16,
          paddingBottom: Math.max(insets.bottom, 24) + 8,
          justifyContent: 'space-between',
        },

        brand: {
          alignItems: 'center',
          paddingTop: Math.min(winH * 0.08, 72),
        },
        logoTile: {
          width: 96,
          height: 96,
          borderRadius: 30,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          ...Platform.select({
            ios: {
              shadowColor: colors.primary.default,
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.35,
              shadowRadius: 28,
            },
            android: { elevation: 18 },
            default: {},
          }),
        },
        ring: {
          width: RING,
          height: RING,
          borderRadius: RING / 2,
          borderWidth: BORDER,
          borderColor: colors.background.card,
        },
        dot1: {
          position: 'absolute',
          width: DOT,
          height: DOT,
          borderRadius: DOT / 2,
          backgroundColor: accent,
          top: -DOT / 2 + BORDER / 2,
          right: 2,
        },
        dot2: {
          position: 'absolute',
          width: DOT,
          height: DOT,
          borderRadius: DOT / 2,
          backgroundColor: accent,
          bottom: -DOT / 2 + BORDER / 2,
          left: 2,
        },
        wordmark: {
          fontSize: 24,
          fontWeight: FontWeights.bold,
          letterSpacing: 6,
          textAlign: 'center',
          fontFamily: fonts.bold,
          color: colors.text.primary,
        },

        spacer: { flex: 1 },

        bottom: { paddingBottom: 4 },
        headline: {
          fontSize: 32,
          fontWeight: '800',
          letterSpacing: 0,
          lineHeight: 38,
          fontFamily: fonts.extrabold,
          color: colors.text.primary,
        },
        sub: {
          marginTop: 16,
          fontSize: 16,
          lineHeight: 24,
          color: colors.text.secondary,
          maxWidth: 310,
        },
        cta: {
          marginTop: 36,
          borderRadius: BorderRadius.full,
          overflow: 'hidden',
          ...Platform.select({
            ios: {
              shadowColor: colors.primary.default,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.5,
              shadowRadius: 22,
            },
            android: { elevation: 10 },
            default: {},
          }),
        },
        ctaInner: {
          paddingVertical: 18,
          alignItems: 'center',
          justifyContent: 'center',
        },
        ctaLabel: {
          color: colors.text.primary,
          fontSize: 16,
          fontWeight: '700',
          letterSpacing: 0.3,
        },
        signInRow: {
          marginTop: 24,
          flexDirection: 'row',
          alignItems: 'center',
        },
        signInMuted: {
          fontSize: FontSizes.sm,
          color: colors.text.tertiary,
        },
        signInLink: {
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.semibold,
          color: colors.text.primary,
        },
      }),
    [accent, colors, fonts, insets, winH]
  );

  return (
    <View style={s.root}>
      <StatusBar style="dark" />

      <LinearGradient
        colors={['#FFFFFF', '#FFF9EA', '#F8EFD1', '#F0DEB9']}
        locations={[0, 0.34, 0.72, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={s.safe}>
        <View style={s.brand}>
          <LinearGradient
            colors={['#8EAA78', '#5F8654']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.logoTile}
          >
            <View style={s.ring}>
              <View style={s.dot1} />
              <View style={s.dot2} />
            </View>
          </LinearGradient>
          <AppText style={s.wordmark} accessibilityRole="header">ORBIT</AppText>
        </View>

        <View style={s.spacer} />

        <View style={s.bottom}>
          <AppText style={s.headline}>Find your{'\n'}people, nearby.</AppText>
          <AppText style={s.sub}>A warmer way to discover plans, people, and conversations around you.</AppText>

          <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/(auth)/register')} style={s.cta}>
            <LinearGradient
              colors={[colors.primary.start, colors.primary.end]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.ctaInner}
            >
              <AppText style={s.ctaLabel}>Get started</AppText>
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.signInRow}>
            <AppText style={s.signInMuted}>Already have an account? </AppText>
            <Pressable onPress={() => router.push('/(auth)/login')} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
              <AppText style={s.signInLink}>Sign in</AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
