/**
 * Tabs Layout - Main App Navigation
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { LocationProvider } from '../../src/context/LocationContext';
import OrbitTabBar from '../../src/components/OrbitTabBar';
import { SessionLocationSync } from '../../src/components/SessionLocationSync';

export default function TabsLayout() {
  return (
    <LocationProvider>
      <SessionLocationSync />
      <View style={styles.tabsRoot}>
        <View style={styles.tabsNavigatorFill}>
          <Tabs
            tabBar={(props) => <OrbitTabBar {...props} />}
            screenOptions={{
              headerShown: false,
              tabBarShowLabel: false,
              tabBarStyle: {
                backgroundColor: 'transparent',
                borderTopWidth: 0,
                elevation: 0,
                shadowOpacity: 0,
              },
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                title: 'Discover',
              }}
            />
            <Tabs.Screen
              name="feed"
              options={{
                title: 'Feed',
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
              }}
            />
            <Tabs.Screen
              name="profile"
              options={{
                title: 'Me',
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
});
