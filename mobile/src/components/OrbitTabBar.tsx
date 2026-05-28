import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useConversationsQuery, useNotificationsQuery } from '../hooks/useOrbitApi';
import { CreateEventModal } from './CreateEventModal';
import { AppText } from '../ui/AppText';
import { useOrbitTheme } from '../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/* ─── Spec tokens ────────────────────────────────────────────────────────── */

const BG          = '#1a1a1f';
const ACTIVE      = '#29b6f6';
const ACTIVE_PILL = 'rgba(41,182,246,0.15)';
const INACTIVE    = '#555566';
const SEPARATOR   = 'rgba(255,255,255,0.06)';

const ROW_H       = 64;   // visible row height (tall enough for 44px FAB + label)
const PILL_SZ     = 36;   // icon wrapper size
const PILL_R      = 10;   // icon wrapper border-radius
const FAB_SZ      = 44;   // New button size
const FAB_R       = 12;   // New button border-radius
const ICON_SZ     = 22;   // regular icon size
const FAB_ICON_SZ = 22;   // FAB + icon size
const LABEL_SZ    = 11;

/* ─── Route config ───────────────────────────────────────────────────────── */

const VISIBLE_ROUTES = ['feed', 'chat', 'notifications', 'profile'] as const;
type VisibleRoute = (typeof VISIBLE_ROUTES)[number];

const SLOT_OF: Record<VisibleRoute, number> = {
  feed: 0, chat: 1, notifications: 3, profile: 4,
};

interface Glyph { active: IconName; inactive: IconName; label: string }
const GLYPHS: Record<VisibleRoute, Glyph> = {
  feed:          { active: 'trending-up',          inactive: 'trending-up-outline',         label: 'Events'  },
  chat:          { active: 'chatbubble-ellipses',  inactive: 'chatbubble-ellipses-outline', label: 'Chat'    },
  notifications: { active: 'notifications',        inactive: 'notifications-outline',       label: 'Notifs'  },
  profile:       { active: 'person',               inactive: 'person-outline',              label: 'Profile' },
};

/* ─── Badge ──────────────────────────────────────────────────────────────── */

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={bdg.dot}>
      {count < 10 && <AppText style={bdg.num}>{count}</AppText>}
    </View>
  );
}
const bdg = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -3,
    right: -4,
    minWidth: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#FF3B5C',
    borderWidth: 1.5,
    borderColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  num: { fontSize: 7.5, color: '#fff', fontWeight: '700', lineHeight: 9 },
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
  const pillOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(pillOpacity, {
      toValue: focused ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [focused, pillOpacity]);

  const onPressIn = useCallback(() => {
    Animated.spring(pressScale, { toValue: 0.82, useNativeDriver: true, speed: 120, bounciness: 0 }).start();
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
      style={ts.slot}
    >
      <Animated.View style={[ts.inner, { transform: [{ scale: pressScale }] }]}>
        {/* Icon wrapper with animated pill */}
        <View style={ts.pillWrap}>
          <Animated.View style={[ts.pill, { opacity: pillOpacity }]} />
          <View style={ts.iconBox}>
            <Ionicons
              name={focused ? g.active : g.inactive}
              size={ICON_SZ}
              color={focused ? ACTIVE : INACTIVE}
            />
            <Badge count={unread} />
          </View>
        </View>
        <AppText style={[ts.label, { fontFamily: fonts.medium, color: focused ? ACTIVE : INACTIVE }]}>
          {label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

const ts = StyleSheet.create({
  slot:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  inner:    { alignItems: 'center', gap: 4 },
  pillWrap: { width: FAB_SZ, height: FAB_SZ, alignItems: 'center', justifyContent: 'center' },
  pill: {
    position: 'absolute',
    width: PILL_SZ,
    height: PILL_SZ,
    borderRadius: PILL_R,
    backgroundColor: ACTIVE_PILL,
  },
  iconBox:  { width: ICON_SZ + 4, height: ICON_SZ + 4, alignItems: 'center', justifyContent: 'center' },
  label:    { fontSize: LABEL_SZ, letterSpacing: 0.1 },
});

/* ─── New (create) slot ──────────────────────────────────────────────────── */

function NewSlot({ onPress }: { onPress: () => void }) {
  const { fonts } = useOrbitTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 120, bounciness: 0 }).start();
  }, [scale]);
  const onPressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 8, stiffness: 200 }).start();
  }, [scale]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel="New event"
      style={ns.slot}
    >
      <Animated.View style={[ns.inner, { transform: [{ scale }] }]}>
        <View style={ns.fab}>
          <Ionicons name="add" size={FAB_ICON_SZ} color="#ffffff" />
        </View>
        <AppText style={[ns.label, { fontFamily: fonts.medium }]}>New</AppText>
      </Animated.View>
    </Pressable>
  );
}

const ns = StyleSheet.create({
  slot:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  inner: { alignItems: 'center', gap: 4 },
  fab: {
    width: FAB_SZ,
    height: FAB_SZ,
    borderRadius: FAB_R,
    backgroundColor: ACTIVE,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: ACTIVE,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  label: { fontSize: LABEL_SZ, color: ACTIVE, letterSpacing: 0.1 },
});

/* ─── Tab bar ────────────────────────────────────────────────────────────── */

export default function OrbitTabBar({
  state, descriptors, navigation, insets,
}: BottomTabBarProps) {
  const bottomPad = Math.max(insets.bottom, 20);
  const barH = ROW_H + bottomPad;

  const { data: convData }  = useConversationsQuery();
  const { data: notifData } = useNotificationsQuery();
  const chatUnread  = useMemo(
    () => (convData ?? []).reduce((s: number, c: { unread_count?: number }) => s + (c.unread_count || 0), 0),
    [convData],
  );
  const notifUnread = notifData?.unread_count ?? 0;

  const [createOpen, setCreateOpen] = useState(false);

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
    (name: string) => name === 'chat' ? chatUnread : name === 'notifications' ? notifUnread : 0,
    [chatUnread, notifUnread],
  );

  return (
    <>
      <View style={[bar.shell, { height: barH, paddingBottom: bottomPad }]}>
        {/* Top separator */}
        <View style={bar.separator} />

        {/* Row */}
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

          <NewSlot onPress={() => setCreateOpen(true)} />

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
      </View>

      <CreateEventModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setCreateOpen(false)}
      />
    </>
  );
}

const bar = StyleSheet.create({
  shell: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BG,
  },
  separator: {
    height: 0.5,
    backgroundColor: SEPARATOR,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
