import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useConversationsQuery, useNotificationsQuery } from '../hooks/useOrbitApi';
import { CreateFAB } from './CreateFAB';
import { AppText } from '../ui/AppText';
import { useAuthStore } from '../stores/authStore';

type IconName = ComponentProps<typeof Ionicons>['name'];

const BAR_BG = '#111111';
const ACCENT = '#00B4D8';
const DARK = '#0D0D0D';
const ACTIVE = '#FFFFFF';
const INACTIVE = '#555555';
const ROW_H = 64;
const ICON_SIZE = 23;
const CREATE_SIZE = 48;

const VISIBLE_ROUTES = ['feed', 'chat', 'notifications', 'profile'] as const;
type VisibleRoute = (typeof VISIBLE_ROUTES)[number];

const SLOT_OF: Record<VisibleRoute, number> = {
  feed: 0,
  chat: 1,
  notifications: 3,
  profile: 4,
};

const GLYPHS: Record<VisibleRoute, { icon: IconName; label: string }> = {
  feed: { icon: 'compass-outline', label: 'Explore' },
  chat: { icon: 'chatbubble-ellipses-outline', label: 'Chat' },
  notifications: { icon: 'notifications-outline', label: 'Notifs' },
  profile: { icon: 'person-circle-outline', label: 'Profile' },
};

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.badge}>
      {count < 10 ? <AppText style={styles.badgeText}>{count}</AppText> : null}
    </View>
  );
}

function TabSlot({
  route,
  focused,
  unread,
  onPress,
  onLongPress,
}: {
  route: VisibleRoute;
  focused: boolean;
  unread: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const dotOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(dotOpacity, {
      toValue: focused ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [dotOpacity, focused]);

  const onPressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 130, bounciness: 0 }).start();
  }, [scale]);
  const onPressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 220 }).start();
  }, [scale]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.slot}
    >
      <Animated.View style={[styles.slotInner, { transform: [{ scale }] }]}>
        <View style={styles.iconWrap}>
          <Ionicons name={GLYPHS[route].icon} size={ICON_SIZE} color={focused ? ACTIVE : INACTIVE} />
          <Badge count={unread} />
        </View>
        <Animated.View style={[styles.activeDot, { opacity: dotOpacity }]} />
      </Animated.View>
    </Pressable>
  );
}

function CreateSlot({ open, onPress }: { open: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: open ? 1 : 0,
      damping: 12,
      stiffness: 180,
      useNativeDriver: false,
    }).start();
  }, [open, progress]);

  const onPressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 130, bounciness: 0 }).start();
  }, [scale]);
  const onPressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 220 }).start();
  }, [scale]);

  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [ACCENT, DARK],
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={open ? 'Close catchup creator' : 'Create catchup'}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={styles.slot}
    >
      <Animated.View style={[styles.createInner, { transform: [{ scale }] }]}>
        <Animated.View style={[styles.createButton, { backgroundColor }]}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name="add" size={30} color="#FFFFFF" />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export default function OrbitTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const bottomPad = Math.max(insets.bottom, 8);
  const user = useAuthStore((s) => s.user);
  const { data: convData } = useConversationsQuery();
  const { data: notifData } = useNotificationsQuery();
  const chatUnread = useMemo(
    () => (convData ?? []).reduce((sum: number, c: { unread_count?: number }) => sum + (c.unread_count || 0), 0),
    [convData]
  );
  const notifUnread = notifData?.unread_count ?? 0;
  const [createOpen, setCreateOpen] = useState(false);

  const navRoutes = useMemo(
    () =>
      [...state.routes]
        .filter((route) => (VISIBLE_ROUTES as readonly string[]).includes(route.name))
        .sort((a, b) => (SLOT_OF[a.name as VisibleRoute] ?? 99) - (SLOT_OF[b.name as VisibleRoute] ?? 99)),
    [state.routes]
  );
  const leftRoutes = navRoutes.filter((route) => SLOT_OF[route.name as VisibleRoute] < 2);
  const rightRoutes = navRoutes.filter((route) => SLOT_OF[route.name as VisibleRoute] > 2);

  const goTo = useCallback(
    (route: (typeof state.routes)[0]) => {
      const focused = state.routes[state.index]?.key === route.key;
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
    },
    [navigation, state]
  );

  const unreadOf = useCallback(
    (name: string) => (name === 'chat' ? chatUnread : name === 'notifications' ? notifUnread : 0),
    [chatUnread, notifUnread]
  );

  return (
    <>
      <View pointerEvents={createOpen ? 'none' : 'box-none'} style={[styles.wrap, createOpen && styles.hidden]}>
        <View style={[styles.bar, { height: ROW_H + bottomPad, paddingBottom: bottomPad }]}>
          {leftRoutes.map((route) => (
            <TabSlot
              key={route.key}
              route={route.name as VisibleRoute}
              focused={state.routes[state.index]?.key === route.key}
              unread={unreadOf(route.name)}
              onPress={() => goTo(route)}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
          ))}

          <CreateSlot open={false} onPress={() => setCreateOpen(true)} />

          {rightRoutes.map((route) => (
            <TabSlot
              key={route.key}
              route={route.name as VisibleRoute}
              focused={state.routes[state.index]?.key === route.key}
              unread={unreadOf(route.name)}
              onPress={() => goTo(route)}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
          ))}
        </View>
      </View>

      <CreateFAB
        controlledOpen={createOpen}
        onOpenChange={setCreateOpen}
        hideLauncher
        initialLat={user?.latitude ?? undefined}
        initialLng={user?.longitude ?? undefined}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60,
    elevation: 60,
  },
  hidden: {
    opacity: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BAR_BG,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 18,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.24,
        shadowRadius: 22,
      },
      android: { elevation: 18 },
      default: {},
    }),
  },
  slot: {
    flex: 1,
    height: ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotInner: {
    height: ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 32,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ACCENT,
    marginTop: 6,
  },
  createInner: {
    height: ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    width: CREATE_SIZE,
    height: CREATE_SIZE,
    borderRadius: CREATE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 14,
  },
  badge: {
    position: 'absolute',
    top: -1,
    right: -1,
    minWidth: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#FF3B5C',
    borderWidth: 1.5,
    borderColor: BAR_BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    fontSize: 7.5,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 9,
  },
});
