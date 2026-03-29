/**
 * Custom bottom tab bar — clean floating dock.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius } from '../../constants/Colors';
import type { OrbitThemeColors } from '../theme/palettes';
import { useOrbitTheme } from '../theme';
import { useConversationsQuery } from '../hooks/useOrbitApi';
import { useLikesReceivedForTab } from '../hooks/useChatTabQueries';

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(99, 86, 216, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type TabIconName = 'compass' | 'newspaper' | 'chatbubbles' | 'person';

function TabBarIcon({
  name,
  focused,
  colors,
}: {
  name: TabIconName;
  focused: boolean;
  colors: OrbitThemeColors;
}) {
  const iconName = focused ? name : (`${name}-outline` as const);
  return (
    <Ionicons
      name={iconName as keyof typeof Ionicons.glyphMap}
      size={22}
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

  return (
    <View style={{ minWidth: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <TabBarIcon name="chatbubbles" focused={focused} colors={colors} />
      {showBadge && (
        <View
          style={{
            position: 'absolute',
            top: -1,
            right: -3,
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

const TAB_ICONS: Record<string, TabIconName> = {
  index: 'compass',
  feed: 'newspaper',
  chat: 'chatbubbles',
  profile: 'person',
};

export default function OrbitTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, resolvedScheme } = useOrbitTheme();
  const visibleRoutes = state.routes.filter((r) => r.name !== 'map');
  const isDark = resolvedScheme === 'dark';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        outer: {
          paddingHorizontal: 16,
          paddingTop: 8,
          backgroundColor: 'transparent',
        },
        bar: {
          borderRadius: BorderRadius.xl,
          backgroundColor: isDark ? colors.background.tertiary : '#FFFFFF',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingVertical: 6,
          paddingHorizontal: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.4 : 0.06,
          shadowRadius: 12,
          elevation: 6,
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
          paddingVertical: 6,
          paddingHorizontal: 14,
          borderRadius: BorderRadius.full,
        },
        label: {
          marginTop: 2,
          fontSize: 10,
          textAlign: 'center',
        },
      }),
    [colors, isDark]
  );

  const activeBg = hexToRgba(colors.primary.default, isDark ? 0.15 : 0.08);
  const rippleColor = hexToRgba(colors.primary.default, 0.1);

  return (
    <View
      style={[
        styles.outer,
        { paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 12) },
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

            const iconName = TAB_ICONS[route.name];
            const showChatBadge = route.name === 'chat';

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
                  pressed && Platform.OS === 'ios' ? { opacity: 0.85 } : null,
                ]}
              >
                <View style={[styles.tabInner, isFocused && { backgroundColor: activeBg }]}>
                  {showChatBadge ? (
                    <ChatTabIcon focused={isFocused} colors={colors} />
                  ) : iconName ? (
                    <TabBarIcon name={iconName} focused={isFocused} colors={colors} />
                  ) : null}
                  <Text
                    style={[
                      styles.label,
                      {
                        color: isFocused ? colors.primary.default : colors.text.tertiary,
                        fontWeight: isFocused ? '600' : '500',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
