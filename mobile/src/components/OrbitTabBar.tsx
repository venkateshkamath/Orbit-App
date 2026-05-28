import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useConversationsQuery, useNotificationsQuery } from '../hooks/useOrbitApi';
import { CreateEventModal } from './CreateEventModal';
import { AppText } from '../ui/AppText';
import { useOrbitTheme } from '../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/* ─── Design tokens ──────────────────────────────────────────────────────── */

const CYAN     = '#00B4D8';
const CYAN_DIM = '#0099BB';
const BLACK    = '#0A0A0A';

const BAR_H      = 62;   // bar visual height (excluding safe-area)
const CREATE_SZ  = 56;   // floating button diameter
const PROTRUDE   = 30;   // how many px the button protrudes ABOVE the bar top
const PULSE_PAD  = 22;   // padding around button for the pulse ring layer
const WRAPPER_SZ = CREATE_SZ + PULSE_PAD * 2;  // 100 px

const ICON_SZ  = 22;
const LABEL_SZ = 9.5;
const IND_W    = 30;
const IND_H    = 3;

/* ─── Route config ───────────────────────────────────────────────────────── */

const VISIBLE_ROUTES = ['feed', 'chat', 'notifications', 'profile'] as const;
type VisibleRoute = (typeof VISIBLE_ROUTES)[number];

/** Maps route name → slot index (0–4; slot 2 is the create button) */
const SLOT_OF: Record<VisibleRoute, number> = {
  feed:          0,
  chat:          1,
  notifications: 3,
  profile:       4,
};

interface Glyph { on: IconName; off: IconName; label: string }
const GLYPHS: Record<VisibleRoute, Glyph> = {
  feed:          { on: 'calendar',      off: 'calendar-outline',      label: 'Events'  },
  chat:          { on: 'chatbubbles',   off: 'chatbubbles-outline',   label: 'Chat'    },
  notifications: { on: 'notifications', off: 'notifications-outline', label: 'Alerts'  },
  profile:       { on: 'person',        off: 'person-outline',        label: 'Me'      },
};

/* ─── Badge ──────────────────────────────────────────────────────────────── */

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={bdg.dot}>
      {count < 10 && (
        <AppText style={bdg.num}>{count}</AppText>
      )}
    </View>
  );
}
const bdg = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF3B5C',
    borderWidth: 1.5,
    borderColor: BLACK,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  num: { fontSize: 8, color: '#fff', fontWeight: '700', lineHeight: 10 },
});

/* ─── Tab slot ───────────────────────────────────────────────────────────── */

function TabSlot({
  route, focused, label, unread, onPress, onLongPress,
}: {
  route: VisibleRoute;
  focused: boolean;
  label: string;
  unread: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { fonts } = useOrbitTheme();
  const g = GLYPHS[route];

  const pressScale = useRef(new Animated.Value(1)).current;
  const iconScale  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(iconScale, {
      toValue: focused ? 1.12 : 1,
      useNativeDriver: true,
      damping: 14,
      stiffness: 220,
    }).start();
  }, [focused, iconScale]);

  const onPressIn  = useCallback(() => {
    Animated.spring(pressScale, { toValue: 0.78, useNativeDriver: true, speed: 120, bounciness: 0 }).start();
  }, [pressScale]);
  const onPressOut = useCallback(() => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, damping: 8, stiffness: 200 }).start();
  }, [pressScale]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={ts.press}
    >
      <Animated.View style={[ts.inner, { transform: [{ scale: pressScale }] }]}>
        <View style={ts.iconBox}>
          <Animated.View style={{ transform: [{ scale: iconScale }] }}>
            <Ionicons
              name={focused ? g.on : g.off}
              size={ICON_SZ}
              color={focused ? CYAN : 'rgba(255,255,255,0.38)'}
            />
          </Animated.View>
          <Badge count={unread} />
        </View>
        <AppText
          style={[
            ts.label,
            {
              fontFamily: fonts.medium,
              color: focused ? CYAN : 'rgba(255,255,255,0.28)',
            },
          ]}
        >
          {label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

const ts = StyleSheet.create({
  press: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 12, paddingBottom: 8 },
  inner: { alignItems: 'center', gap: 5 },
  iconBox: { width: ICON_SZ + 8, height: ICON_SZ + 4, alignItems: 'center', justifyContent: 'center' },
  label:   { fontSize: LABEL_SZ, letterSpacing: 0.3 },
});

/* ─── Create button ──────────────────────────────────────────────────────── */

function CreateButton({ onPress, open }: { onPress: () => void; open: boolean }) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const rotation   = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOp    = useRef(new Animated.Value(0.5)).current;

  /* Rotate "+" → "×" when open */
  useEffect(() => {
    Animated.spring(rotation, {
      toValue: open ? 1 : 0,
      useNativeDriver: true,
      damping: 12,
      stiffness: 160,
    }).start();
  }, [open, rotation]);

  /* Pulse ring loop */
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 1.6,
            duration: 1400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOp, {
            toValue: 0,
            duration: 1400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseScale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOp,    { toValue: 0.5, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(800),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseScale, pulseOp]);

  const onPressIn  = useCallback(() => {
    Animated.spring(pressScale, { toValue: 0.86, useNativeDriver: true, speed: 120, bounciness: 0 }).start();
  }, [pressScale]);
  const onPressOut = useCallback(() => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, damping: 7, stiffness: 220 }).start();
  }, [pressScale]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  return (
    <View style={cb.wrapper} pointerEvents="box-none">
      {/* Pulse ring */}
      <Animated.View
        pointerEvents="none"
        style={[
          cb.pulse,
          { transform: [{ scale: pulseScale }], opacity: pulseOp },
        ]}
      />
      {/* Button */}
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel="Create event"
        style={cb.pressable}
      >
        <Animated.View
          style={[
            cb.circle,
            { backgroundColor: open ? CYAN_DIM : CYAN },
            { transform: [{ scale: pressScale }] },
          ]}
        >
          {/* Inner rim highlight */}
          <View style={cb.rim} pointerEvents="none" />
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="add" size={30} color="#FFFFFF" />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const cb = StyleSheet.create({
  wrapper: {
    width: WRAPPER_SZ,
    height: WRAPPER_SZ,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: CREATE_SZ,
    height: CREATE_SZ,
    borderRadius: CREATE_SZ / 2,
    backgroundColor: CYAN,
  },
  pressable: {
    width: CREATE_SZ,
    height: CREATE_SZ,
    ...Platform.select({
      ios: {
        shadowColor: CYAN,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.7,
        shadowRadius: 18,
      },
      android: { elevation: 14 },
      default: {},
    }),
  },
  circle: {
    width: CREATE_SZ,
    height: CREATE_SZ,
    borderRadius: CREATE_SZ / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CREATE_SZ / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
});

/* ─── Tab bar ────────────────────────────────────────────────────────────── */

export default function OrbitTabBar({
  state, descriptors, navigation, insets,
}: BottomTabBarProps) {
  const screenW   = Dimensions.get('window').width;
  const slotW     = screenW / 5;
  const safeBot   = Math.max(insets.bottom, 0);
  const barH      = BAR_H + safeBot;             // total bar container height
  const outerH    = barH + PROTRUDE + PULSE_PAD; // outer container height (includes button overhang)

  const { data: convData } = useConversationsQuery();
  const { data: notifData } = useNotificationsQuery();
  const chatUnread  = useMemo(
    () => (convData ?? []).reduce((s: number, c: { unread_count?: number }) => s + (c.unread_count || 0), 0),
    [convData],
  );
  const notifUnread = notifData?.unread_count ?? 0;

  const [createOpen, setCreateOpen] = useState(false);

  /* Active slot */
  const activeRoute = state.routes[state.index];
  const activeSlot  = SLOT_OF[activeRoute?.name as VisibleRoute] ?? -1;

  /* Indicator translation */
  const indicatorX = useRef(
    new Animated.Value(activeSlot >= 0 ? slotW * activeSlot + (slotW - IND_W) / 2 : 0),
  ).current;
  const firstRender = useRef(true);

  useEffect(() => {
    if (activeSlot < 0) return;
    const toX = slotW * activeSlot + (slotW - IND_W) / 2;
    if (firstRender.current) {
      indicatorX.setValue(toX);
      firstRender.current = false;
      return;
    }
    Animated.spring(indicatorX, {
      toValue: toX,
      useNativeDriver: true,
      damping: 24,
      stiffness: 220,
    }).start();
  }, [activeSlot, slotW, indicatorX]);

  /* Filter to only our visible routes, maintain slot order */
  const navRoutes = useMemo(
    () =>
      [...state.routes]
        .filter((r) => (VISIBLE_ROUTES as readonly string[]).includes(r.name))
        .sort((a, b) => (SLOT_OF[a.name as VisibleRoute] ?? 99) - (SLOT_OF[b.name as VisibleRoute] ?? 99)),
    [state.routes],
  );
  const leftRoutes  = navRoutes.filter((r) => SLOT_OF[r.name as VisibleRoute] < 2);
  const rightRoutes = navRoutes.filter((r) => SLOT_OF[r.name as VisibleRoute] > 2);

  const goTo = useCallback(
    (route: (typeof state.routes)[0]) => {
      const focused = state.routes[state.index]?.key === route.key;
      const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !ev.defaultPrevented) navigation.navigate(route.name as never);
    },
    [navigation, state],
  );

  const unreadOf = useCallback(
    (name: string) => (name === 'chat' ? chatUnread : name === 'notifications' ? notifUnread : 0),
    [chatUnread, notifUnread],
  );

  /* Bar shell — BlurView on native, solid bg on web */
  const renderBar = () => {
    const content = (
      <>
        {/* Top hairline */}
        <View style={bar.hairline} pointerEvents="none" />

        {/* Cyan glow on top edge, centred behind the create button */}
        <View
          pointerEvents="none"
          style={[bar.centerGlow, { left: screenW / 2 - 64 }]}
        />

        {/* Sliding active indicator */}
        <Animated.View
          pointerEvents="none"
          style={[bar.indicator, { transform: [{ translateX: indicatorX }] }]}
        />

        {/* Slots */}
        <View style={bar.row}>
          {leftRoutes.map((route) => (
            <TabSlot
              key={route.key}
              route={route.name as VisibleRoute}
              focused={state.routes[state.index]?.key === route.key}
              label={descriptors[route.key]?.options?.title ?? route.name}
              unread={unreadOf(route.name)}
              onPress={() => goTo(route)}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
          ))}

          {/* Centre placeholder — same width as a regular slot */}
          <View style={{ width: slotW }} pointerEvents="none" />

          {rightRoutes.map((route) => (
            <TabSlot
              key={route.key}
              route={route.name as VisibleRoute}
              focused={state.routes[state.index]?.key === route.key}
              label={descriptors[route.key]?.options?.title ?? route.name}
              unread={unreadOf(route.name)}
              onPress={() => goTo(route)}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
          ))}
        </View>

        {/* Safe-area filler */}
        {safeBot > 0 && <View style={{ height: safeBot }} />}
      </>
    );

    if (Platform.OS === 'web') {
      return (
        <View style={[bar.shell, { height: barH, backgroundColor: 'rgba(10,10,10,0.98)' }]}>
          {content}
        </View>
      );
    }
    return (
      <BlurView
        intensity={94}
        tint="dark"
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
        style={[bar.shell, { height: barH }]}
      >
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, bar.overlay]} />
        {content}
      </BlurView>
    );
  };

  /* Button bottom edge sits exactly at bar top, so button centre is PROTRUDE/2 above bar */
  const btnBottom = barH - (CREATE_SZ - PROTRUDE); // wrapper bottom from screen bottom
  const btnLeft   = screenW / 2 - WRAPPER_SZ / 2;

  return (
    <>
      {/* ── Outer container (passes touches through transparent areas) ─────── */}
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: outerH }}
      >
        {/* Bar anchored to the bottom */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          {renderBar()}
        </View>

        {/* Floating create button */}
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            bottom: btnBottom,
            left: btnLeft,
            width: WRAPPER_SZ,
            height: WRAPPER_SZ,
          }}
        >
          <CreateButton onPress={() => setCreateOpen(true)} open={createOpen} />
        </View>
      </View>

      {/* Create event modal */}
      <CreateEventModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setCreateOpen(false)}
      />
    </>
  );
}

/* ─── Shared bar styles ──────────────────────────────────────────────────── */

const bar = StyleSheet.create({
  shell: {
    width: '100%',
    overflow: 'hidden',
  },
  overlay: {
    backgroundColor: 'rgba(6,6,6,0.80)',
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    width: '100%',
  },
  centerGlow: {
    position: 'absolute',
    top: 0,
    width: 128,
    height: 2,
    ...Platform.select({
      ios: {
        shadowColor: CYAN,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.85,
        shadowRadius: 14,
      },
      default: {},
    }),
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: IND_W,
    height: IND_H,
    borderRadius: IND_H / 2,
    backgroundColor: CYAN,
    ...Platform.select({
      ios: {
        shadowColor: CYAN,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  row: {
    flexDirection: 'row',
    height: BAR_H,
    alignItems: 'center',
  },
});
