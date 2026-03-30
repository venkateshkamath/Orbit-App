/**
 * Custom bottom tab bar — dark dock-style bar with distinctive tab marks.
 */

import React, { useMemo } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { BorderRadius } from '../../constants/Colors';
import type { OrbitThemeColors } from '../theme/palettes';
import { useOrbitTheme } from '../theme';
import { useConversationsQuery } from '../hooks/useOrbitApi';
import { useLikesReceivedForTab } from '../hooks/useChatTabQueries';
import { useAuthStore } from '../stores';
import { Avatar } from './Avatar';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/** Filled + outline pairs — avoids generic map / plane metaphors. */
const TAB_GLYPHS: Record<string, { active: IoniconName; inactive: IoniconName }> = {
  index: { active: 'people', inactive: 'people-outline' },
  feed: { active: 'images', inactive: 'images-outline' },
  chat: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
};

function TabBarIcon({
  active,
  inactive,
  focused,
  colors,
  size = 24,
}: {
  active: IoniconName;
  inactive: IoniconName;
  focused: boolean;
  colors: OrbitThemeColors;
  size?: number;
}) {
  return (
    <Ionicons
      name={focused ? active : inactive}
      size={size}
      color={focused ? colors.primary.default : colors.text.tertiary}
    />
  );
}

function ChatTabIcon({
  focused,
  colors,
}: {
  focused: boolean;
  colors: OrbitThemeColors;
}) {
  const { data: conversations = [] } = useConversationsQuery();
  const { data: pendingOrbits = [] } = useLikesReceivedForTab();

  const unreadCount = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const pendingList = Array.isArray(pendingOrbits) ? pendingOrbits : [];
  const showBadge = unreadCount > 0 || pendingList.length > 0;
  const g = TAB_GLYPHS.chat;

  return (
    <View style={{ minWidth: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
      <TabBarIcon active={g.active} inactive={g.inactive} focused={focused} colors={colors} />
      {showBadge && (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -4,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.secondary.default,
            borderWidth: 1.5,
            borderColor: colors.background.card,
          }}
        />
      )}
    </View>
  );
}

export default function OrbitTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, resolvedScheme } = useOrbitTheme();
  const user = useAuthStore((s) => s.user);
  const visibleRoutes = state.routes.filter((r) => r.name !== 'map');
  const isDark = resolvedScheme === 'dark';

  const dockBg = isDark ? 'rgba(14, 12, 36, 0.94)' : 'rgba(255, 255, 255, 0.96)';
  const dockBorder = isDark ? 'rgba(255,255,255,0.08)' : colors.border;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        outer: {
          paddingHorizontal: 10,
          paddingTop: 6,
          backgroundColor: 'transparent',
        },
        bar: {
          borderTopLeftRadius: BorderRadius.xxl + 4,
          borderTopRightRadius: BorderRadius.xxl + 4,
          borderBottomLeftRadius: BorderRadius.md,
          borderBottomRightRadius: BorderRadius.md,
          backgroundColor: dockBg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: dockBorder,
          paddingVertical: 10,
          paddingHorizontal: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: isDark ? 0.35 : 0.08,
          shadowRadius: 16,
          elevation: 12,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        tab: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabInner: {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 4,
          paddingHorizontal: 12,
          borderRadius: BorderRadius.full,
        },
        profileRing: {
          borderWidth: 2,
          borderRadius: BorderRadius.full,
          padding: 2,
        },
      }),
    [dockBg, dockBorder, isDark]
  );

  const rippleColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';

  return (
    <View
      style={[
        styles.outer,
        { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 10) },
      ]}
    >
      <View style={styles.bar}>
        <View style={styles.row}>
          {visibleRoutes.map((route) => {
            const { options } = descriptors[route.key];
            const label = options.title ?? route.name;
            const isFocused = state.routes[state.index]?.key === route.key;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name as never);
              }
            };

            const glyphs = TAB_GLYPHS[route.name];
            const showChatBadge = route.name === 'chat';
            const isProfile = route.name === 'profile';

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                onPress={onPress}
                android_ripple={{ color: rippleColor, borderless: false }}
                style={({ pressed }) => [
                  styles.tab,
                  pressed && Platform.OS === 'ios' ? { opacity: 0.88 } : null,
                ]}
              >
                <View style={styles.tabInner}>
                  {isProfile && user ? (
                    <View
                      style={[
                        styles.profileRing,
                        {
                          borderColor: isFocused ? colors.primary.default : 'transparent',
                        },
                      ]}
                    >
                      <Avatar uri={user.avatar} name={user.username} size={26} />
                    </View>
                  ) : showChatBadge ? (
                    <ChatTabIcon focused={isFocused} colors={colors} />
                  ) : glyphs ? (
                    <TabBarIcon
                      active={glyphs.active}
                      inactive={glyphs.inactive}
                      focused={isFocused}
                      colors={colors}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
