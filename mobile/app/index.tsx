import React, { useMemo } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, FontSizes, FontWeights } from '../constants/Colors';
import { useOrbitTheme } from '../src/theme';
import { AppText } from '../src/ui/AppText';

export default function WelcomeScreen() {
  const { fonts } = useOrbitTheme();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();

  const isNarrow = winW < 380;
  const pageX = isNarrow ? 22 : 28;

  const s = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1 },
        safe: {
          flex: 1,
          paddingHorizontal: pageX,
          paddingTop: Math.max(insets.top, 16) + 16,
          paddingBottom: Math.max(insets.bottom, 18),
        },
        topBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 18,
        },
        wordmark: {
          fontSize: 40,
          fontWeight: FontWeights.bold,
          letterSpacing: -1,
          fontFamily: fonts.bold,
          color: '#10BFEF',
        },
        loginText: {
          color: '#555555',
          fontSize: 14,
          fontWeight: FontWeights.medium,
          fontFamily: fonts.medium,
        },
        content: {
          flex: 1,
          justifyContent: 'center',
          paddingBottom: 120,
        },
        badge: {
          alignSelf: 'flex-start',
          borderRadius: BorderRadius.full,
          paddingHorizontal: 12,
          paddingVertical: 7,
          backgroundColor: '#E0F7FA',
          marginBottom: 20,
        },
        badgeText: {
          color: '#0497B8',
          fontSize: FontSizes.xs,
          fontWeight: FontWeights.semibold,
          fontFamily: fonts.semibold,
        },
        headline: {
          color: '#050505',
          fontSize: isNarrow ? 40 : 46,
          lineHeight: isNarrow ? 46 : 52,
          fontWeight: '800',
          letterSpacing: -0.5,
          fontFamily: fonts.extrabold,
          marginBottom: 16,
        },
        accentWord: { color: '#10BFEF' },
        sub: {
          color: '#6E7687',
          fontSize: 17,
          lineHeight: 25,
          fontFamily: fonts.regular,
        },
        cta: {
          position: 'absolute',
          left: pageX,
          right: pageX,
          bottom: Math.max(insets.bottom, 18) + 36,
          minHeight: 56,
          borderRadius: BorderRadius.full,
          backgroundColor: '#101010',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 24,
          paddingRight: 6,
          ...Platform.select({
            ios: {
              shadowColor: '#111111',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.16,
              shadowRadius: 22,
            },
            android: { elevation: 5 },
            default: {},
          }),
        },
        ctaText: {
          flex: 1,
          color: '#FFFFFF',
          fontSize: 16,
          fontWeight: FontWeights.bold,
          fontFamily: fonts.extrabold,
          textAlign: 'left',
        },
        arrowCircle: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#10BFEF',
        },
        socialProof: {
          position: 'absolute',
          left: pageX,
          right: pageX,
          bottom: Math.max(insets.bottom, 18) + 4,
          color: '#7B8492',
          textAlign: 'center',
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.medium,
          fontFamily: fonts.medium,
        },
      }),
    [fonts, insets.bottom, insets.top, isNarrow, pageX]
  );

  return (
    <View style={s.root}>
      <StatusBar style="dark" />

      <LinearGradient
        colors={['#DDF8FF', '#EFFBFD', '#F8FCFC', '#FFFFFF']}
        locations={[0, 0.36, 0.64, 1]}
        start={{ x: 0.35, y: 0 }}
        end={{ x: 0.52, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={s.safe}>
        <View style={s.topBar}>
          <AppText style={s.wordmark} accessibilityRole="header">orbit</AppText>
          <Pressable
            onPress={() => router.push('/(auth)/login')}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <AppText style={s.loginText}>Log in</AppText>
          </Pressable>
        </View>

        <View style={s.content}>
          <View style={s.badge}>
            <AppText style={s.badgeText}>Hyper-local micro-events</AppText>
          </View>
          <AppText style={s.headline}>
            Step outside.{'\n'}Someone's{' '}
            <AppText style={[s.headline, s.accentWord]}>already</AppText>
            {' '}out there
          </AppText>
          <AppText style={s.sub}>Coffee runs, smoke breaks, sunrise treks.</AppText>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push('/(auth)/register')}
        style={s.cta}
      >
        <AppText style={s.ctaText}>Get started</AppText>
        <View style={s.arrowCircle}>
          <Ionicons name="arrow-forward" size={24} color="#050505" />
        </View>
      </TouchableOpacity>
      <AppText style={s.socialProof}>Join 2,400 people nearby</AppText>
    </View>
  );
}
