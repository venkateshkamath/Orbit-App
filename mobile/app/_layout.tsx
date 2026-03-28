/**
 * ORBIT - Root Layout
 * Handles authentication routing
 */

import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores';
import { OrbitQueryProvider } from '../src/lib/queryClient';
import { ChatRealtimeBridge } from '../src/components/ChatRealtimeBridge';
import {
  installNotificationHandlerSafe,
  prepareNotificationEnvironment,
  tryRegisterExpoPushToken,
} from '../src/lib/notificationsSafe';
import { Colors } from '../constants/Colors';
import { authApi } from '../src/api/auth';

function RootLayoutNav() {
  const { isLoading, loadUser, isAuthenticated, isOnboardingComplete } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadUser();
    installNotificationHandlerSafe();
  }, []);

  useEffect(() => {
    if (!mounted || isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const inTabsGroup = segments[0] === '(tabs)';
    const inChatStack = segments[0] === 'chat';
    const inUserStack = segments[0] === 'user';
    const inMainApp = inTabsGroup || inChatStack || inUserStack;

    // Redirect logic
    if (!isAuthenticated) {
      // Not authenticated - should be on welcome or auth screens
      if (inTabsGroup || inOnboardingGroup) {
        router.replace('/');
      }
    } else if (!isOnboardingComplete) {
      // Authenticated but needs onboarding
      if (!inOnboardingGroup) {
        router.replace('/(onboarding)/interests');
      }
    } else {
      // Fully authenticated — tabs, chat thread, or user profile
      if (!inMainApp) {
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, isOnboardingComplete, isLoading, mounted, segments, router]);

  useEffect(() => {
    if (!mounted || isLoading || !isAuthenticated || !isOnboardingComplete) return undefined;

    void prepareNotificationEnvironment();

    let cancelled = false;
    void tryRegisterExpoPushToken(
      async (token) => {
        if (cancelled) return;
        try {
          await authApi.registerExpoPushToken(token);
        } catch (e) {
          console.warn('[notifications] registerExpoPushToken API failed:', e);
        }
      },
      { isCancelled: () => cancelled }
    );

    return () => {
      cancelled = true;
    };
  }, [mounted, isLoading, isAuthenticated, isOnboardingComplete]);

  if (isLoading || !mounted) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={Colors.primary.default} />
        <Text style={styles.loadingText}>Loading ORBIT...</Text>
      </View>
    );
  }

  return (
    <View style={styles.slotRoot}>
      <StatusBar style="light" />
      <Slot />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider style={styles.container}>
        <OrbitQueryProvider>
          <ChatRealtimeBridge />
          <RootLayoutNav />
        </OrbitQueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  slotRoot: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
  },
  loadingText: {
    color: Colors.text.secondary,
    marginTop: 16,
    fontSize: 16,
  },
  logoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  logoutContainer: {
    backgroundColor: Colors.background.card,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
  },
});
