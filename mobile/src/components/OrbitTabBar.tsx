/**
 * Floating glassmorphism tab bar.
 * Fixed-gap layout — zero measurement, zero race conditions.
 * Smooth sliding active disc, dark/light theme aware.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { OrbitThemeColors } from '../theme/palettes';
import { useOrbitTheme } from '../theme';
import { useConversationsQuery } from '../hooks/useOrbitApi';
import { useLikesReceivedForTab } from '../hooks/useChatTabQueries';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const CIRCLE = 50;
const GAP = 16;
const ICON_SZ = 21;
const PILL_PAD = 7;
const PILL_RADIUS = (CIRCLE + PILL_PAD * 2) / 2;
const SLOT = CIRCLE + GAP;

const TAB_GLYPHS: Record<string, { on: IoniconName; off: IoniconName }> = {
  index: { on: 'compass', off: 'compass-outline' },
  feed: { on: 'flash', off: 'flash-outline' },
  chat: { on: 'chatbubbles', off: 'chatbubbles-outline' },
  profile: { on: 'person', off: 'person-outline' },
};

/* ── Theme tokens ──────────────────────────────────────────────── */

function useTokens(isDark: boolean, colors: OrbitThemeColors) {
  return useMemo(() => {
    if (isDark) {
      return {
        pillTint: 'rgba(8,14,28,0.32)',
        pillBorder: 'rgba(255,255,255,0.13)',
        pillHighlight: 'rgba(255,255,255,0.18)',
        blur: { tint: 'dark' as const, intensity: 96 },
        circle: { bg: 'rgba(0,0,0,0.44)', border: 'rgba(255,255,255,0.09)' },
        disc: { bg: '#FFFFFF', shadow: '#FFFFFF' },
        icon: { on: '#0E1220', off: 'rgba(200,210,232,0.85)' },
        badge: { ringOn: '#FFFFFF', ringOff: '#0C1018' },
      };
    }
    return {
      pillTint: 'rgba(255,255,255,0.28)',
      pillBorder: 'rgba(15,23,42,0.07)',
      pillHighlight: 'rgba(255,255,255,0.88)',
      blur: { tint: 'light' as const, intensity: 82 },
      circle: { bg: 'rgba(0,0,0,0.05)', border: 'rgba(0,0,0,0.04)' },
      disc: { bg: colors.primary.default, shadow: colors.primary.default },
      icon: { on: '#FFFFFF', off: 'rgba(30,41,59,0.65)' },
      badge: { ringOn: colors.primary.default, ringOff: '#EEF0F6' },
    };
  }, [isDark, colors.primary.default]);
}

/* ── Chat badge ────────────────────────────────────────────────── */

function ChatBadge({
  focused,
  colors,
  t,
}: {
  focused: boolean;
  colors: OrbitThemeColors;
  t: ReturnType<typeof useTokens>;
}) {
  const { data: conversations = [] } = useConversationsQuery();
  const { data: pendingOrbits = [] } = useLikesReceivedForTab();
  const unread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);
  const pending = Array.isArray(pendingOrbits) ? pendingOrbits : [];
  const show = unread > 0 || pending.length > 0;

  return (
    <View style={badge.wrap}>
      <Ionicons
        name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
        size={ICON_SZ}
        color={focused ? t.icon.on : t.icon.off}
      />
      {show && (
        <View
          style={[
            badge.dot,
            {
              backgroundColor: colors.secondary.default,
              borderColor: focused ? t.badge.ringOn : t.badge.ringOff,
            },
          ]}
        />
      )}
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    top: -3,
    right: -6,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
  },
});

/* ── Tab bar ───────────────────────────────────────────────────── */

export default function OrbitTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  const { colors, resolvedScheme } = useOrbitTheme();
  const isDark = resolvedScheme === 'dark';
  const t = useTokens(isDark, colors);

  const visible = state.routes.filter((r) => r.name !== 'map');
  const activeKey = state.routes[state.index]?.key;
  const idx = Math.max(0, visible.findIndex((r) => r.key === activeKey));

  const target = idx * SLOT;
  const anim = useRef(new Animated.Value(target)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      anim.setValue(target);
      first.current = false;
      return;
    }
    Animated.timing(anim, {
      toValue: target,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, target]);

  const s = useMemo(
    () =>
      StyleSheet.create({
        outer: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          paddingBottom: Math.max(insets.bottom - 2, Platform.OS === 'android' ? 10 : 8),
          pointerEvents: 'box-none',
        },
        pill: {
          borderRadius: PILL_RADIUS,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.pillBorder,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: isDark ? 0.34 : 0.09,
              shadowRadius: 22,
            },
            android: { elevation: 10 },
            default: {},
          }),
        },
        inner: {
          padding: PILL_PAD,
        },
        glassHighlight: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: PILL_RADIUS,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: t.pillHighlight,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: GAP,
        },
        slot: {
          width: CIRCLE,
          height: CIRCLE,
          alignItems: 'center',
          justifyContent: 'center',
        },
        circleBg: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: CIRCLE / 2,
          backgroundColor: t.circle.bg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.circle.border,
        },
        disc: {
          position: 'absolute',
          left: 0,
          top: 0,
          width: CIRCLE,
          height: CIRCLE,
          borderRadius: CIRCLE / 2,
          backgroundColor: t.disc.bg,
          ...Platform.select({
            ios: {
              shadowColor: t.disc.shadow,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.15 : 0.22,
              shadowRadius: 10,
            },
            android: { elevation: 4 },
            default: {},
          }),
        },
        iconZ: { zIndex: 3 },
      }),
    [isDark, insets.bottom, t]
  );

  const shell = (children: React.ReactNode) => {
    if (Platform.OS === 'web') {
      return (
        <View style={[s.pill, { backgroundColor: isDark ? 'rgba(10,16,32,0.78)' : 'rgba(255,255,255,0.82)' }]}>
          <View style={s.inner}>{children}</View>
        </View>
      );
    }
    return (
      <BlurView
        intensity={t.blur.intensity}
        tint={t.blur.tint}
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
        blurReductionFactor={Platform.OS === 'android' ? 3.6 : 4}
        style={s.pill}
      >
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: t.pillTint }]} />
        <View pointerEvents="none" style={s.glassHighlight} />
        <View style={s.inner}>{children}</View>
      </BlurView>
    );
  };

  return (
    <View style={s.outer}>
      {shell(
        <View style={s.row}>
          <Animated.View
            pointerEvents="none"
            style={[s.disc, { transform: [{ translateX: anim }] }]}
          />
          {visible.map((route) => {
            const { options } = descriptors[route.key];
            const label = options.title ?? route.name;
            const focused = state.routes[state.index]?.key === route.key;
            const glyphs = TAB_GLYPHS[route.name];
            const color = focused ? t.icon.on : t.icon.off;

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                onPress={() => {
                  const ev = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !ev.defaultPrevented)
                    navigation.navigate(route.name as never);
                }}
                style={({ pressed }) => [
                  s.slot,
                  pressed && Platform.OS === 'ios' ? { opacity: 0.85 } : null,
                ]}
              >
                {!focused && <View style={s.circleBg} />}
                <View style={s.iconZ}>
                  {route.name === 'chat' ? (
                    <ChatBadge focused={focused} colors={colors} t={t} />
                  ) : glyphs ? (
                    <Ionicons
                      name={focused ? glyphs.on : glyphs.off}
                      size={ICON_SZ}
                      color={color}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
