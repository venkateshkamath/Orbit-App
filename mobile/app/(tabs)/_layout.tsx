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
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'transparent',
                borderTopWidth: 0,
                elevation: 0,
                shadowOpacity: 0,
                height: undefined,
              },
            }}
          >
            <Tabs.Screen name="feed" options={{ title: 'Events' }} />
            <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
            <Tabs.Screen name="notifications" options={{ title: 'Notifications' }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
            {/* Hidden screens — accessible via deep link / programmatic nav */}
            <Tabs.Screen name="index" options={{ href: null }} />
            <Tabs.Screen name="map" options={{ href: null }} />
          </Tabs>
        </View>
      </View>
    </LocationProvider>
  );
}

const styles = StyleSheet.create({
  tabsRoot: { flex: 1 },
  tabsNavigatorFill: { flex: 1 },
});
