/**
 * Tabs Layout - Main App Navigation
 */

import React, { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { LocationProvider } from '../../src/context/LocationContext';
import { useConversationsQuery } from '../../src/hooks/useOrbitApi';
import { useLikesReceivedForTab, useNotificationsForTab } from '../../src/hooks/useChatTabQueries';

type TabIconName = 'compass' | 'newspaper' | 'map' | 'chatbubbles' | 'person';

/** Keep icon + label aligned: no extra pill wrapper (breaks Android tab layout). */
function TabBarIcon({
  name,
  focused,
}: {
  name: TabIconName;
  focused: boolean;
}) {
  const iconName = focused ? name : (`${name}-outline` as const);
  return (
    <Ionicons
      name={iconName as any}
      size={Platform.OS === 'android' ? 24 : 22}
      color={focused ? Colors.primary.default : Colors.text.tertiary}
    />
  );
}

function ChatTabIcon({ focused }: { focused: boolean }) {
  const { data: conversations = [] } = useConversationsQuery();
  const { data: pendingOrbits = [] } = useLikesReceivedForTab();
  const { data: notifPack } = useNotificationsForTab();

  const unreadCount = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const pendingList = Array.isArray(pendingOrbits) ? pendingOrbits : [];
  const pendingCount = pendingList.length + (notifPack?.unread_count ?? 0);
  const showBadge = unreadCount > 0 || pendingCount > 0;

  return (
    <View style={styles.chatIconSlot} collapsable={false}>
      <TabBarIcon name="chatbubbles" focused={focused} />
      {showBadge && <View style={styles.badgeDot} />}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  const tabBarStyle = useMemo(
    () => ({
      backgroundColor: Colors.background.card,
      borderTopColor: Colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: Platform.OS === 'android' ? 6 : 8,
      paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 10),
      minHeight: Platform.OS === 'android' ? 52 + Math.max(insets.bottom, 8) : 56 + Math.max(insets.bottom, 10),
    }),
    [insets.bottom]
  );

  return (
    <LocationProvider>
      <View style={styles.tabsRoot}>
        <View style={styles.tabsNavigatorFill}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle,
              tabBarShowLabel: true,
              tabBarLabelStyle: styles.tabBarLabel,
              tabBarActiveTintColor: Colors.primary.default,
              tabBarInactiveTintColor: Colors.text.tertiary,
              tabBarItemStyle: styles.tabBarItem,
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                title: 'Discover',
                tabBarIcon: ({ focused }) => <TabBarIcon name="compass" focused={focused} />,
              }}
            />
            <Tabs.Screen
              name="feed"
              options={{
                title: 'Feed',
                tabBarIcon: ({ focused }) => <TabBarIcon name="newspaper" focused={focused} />,
              }}
            />
            <Tabs.Screen
              name="map"
              options={{
                href: null,
              }}
            />
            <Tabs.Screen
              name="chat"
              options={{
                title: 'Messages',
                tabBarIcon: ({ focused }) => <ChatTabIcon focused={focused} />,
              }}
            />
            <Tabs.Screen
              name="profile"
              options={{
                title: 'Profile',
                tabBarIcon: ({ focused }) => <TabBarIcon name="person" focused={focused} />,
              }}
            />
          </Tabs>
        </View>
      </View>
    </LocationProvider>
  );
}

const styles = StyleSheet.create({
  tabsRoot: {
    flex: 1,
  },
  /** Bottom tabs must sit in a flex:1 sibling or scene area collapses (blank white content). */
  tabsNavigatorFill: {
    flex: 1,
  },
  tabBarItem: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  tabBarLabel: {
    fontSize: Platform.OS === 'android' ? 11 : 10,
    fontWeight: '600',
    letterSpacing: Platform.OS === 'android' ? 0 : 0.2,
    marginTop: Platform.OS === 'android' ? 2 : 4,
    marginBottom: 0,
  },
  chatIconSlot: {
    minWidth: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: -1,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    borderWidth: 2,
    borderColor: Colors.background.card,
  },
});
