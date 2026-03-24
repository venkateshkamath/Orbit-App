/**
 * Tabs Layout - Main App Navigation
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing } from '../../constants/Colors';
import { useChatStore } from '../../src/stores';

type TabIconName = 'compass' | 'newspaper' | 'map' | 'chatbubbles' | 'person';

function TabBarIcon({
  name,
  focused,
}: {
  name: TabIconName;
  focused: boolean;
}) {
  const iconName = focused ? name : (`${name}-outline` as const);
  
  if (focused) {
    return (
      <View style={styles.activeIconContainer}>
        <LinearGradient
          colors={[Colors.primary.start, Colors.primary.end]}
          style={styles.activeIconGradient}
        >
          <Ionicons name={iconName as any} size={24} color={Colors.text.primary} />
        </LinearGradient>
      </View>
    );
  }

  return (
    <Ionicons
      name={iconName as any}
      size={24}
      color={Colors.text.tertiary}
    />
  );
}

function ChatTabIcon({ focused }: { focused: boolean }) {
  const { conversations } = useChatStore();
  const unreadCount = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <View>
      <TabBarIcon name="chatbubbles" focused={focused} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Ionicons name="ellipse" size={10} color={Colors.error} />
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarActiveTintColor: Colors.primary.default,
        tabBarInactiveTintColor: Colors.text.tertiary,
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
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.background.secondary,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingTop: Spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? Spacing.xl : Spacing.sm,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  activeIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconGradient: {
    width: 48,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
  },
});
