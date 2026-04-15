/**
 * ORBIT - Root Layout
 * Handles authentication routing
 */

import { useEffect, useState, useMemo } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
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
import { ThemeProvider, useOrbitTheme } from '../src/theme';
import { AppText } from '../src/ui/AppText';
import { authApi } from '../src/api/auth';

function RootLayoutNav() {
  const { colors, resolvedScheme, fonts } = useOrbitTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        slotRoot: {
          flex: 1,
          backgroundColor: colors.background.primary,
        },
        loadingContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background.primary,
        },
        loadingText: {
          color: colors.text.secondary,
          marginTop: 16,
          fontSize: 16,
          fontFamily: fonts.medium,
        },
      }),
    [colors, fonts]
  );
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
    const inSearchStack = segments[0] === 'search';
    /** Lets completed users open interests from Profile without being forced back to tabs. */
    const inOnboardingInterests =
      segments[0] === '(onboarding)' && segments[1] === 'interests';
    const inMainApp =
      inTabsGroup || inChatStack || inUserStack || inSearchStack || inOnboardingInterests;

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

  const statusStyle = resolvedScheme === 'dark' ? 'light' : 'dark';

  if (isLoading || !mounted) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style={statusStyle} />
        <ActivityIndicator size="large" color={colors.primary.default} />
        <AppText style={styles.loadingText}>Loading ORBIT...</AppText>
      </View>
    );
  }

  return (
    <View style={styles.slotRoot}>
      <StatusBar style={statusStyle} />
      <Slot />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={layoutStyles.flex}>
      <SafeAreaProvider style={layoutStyles.flex}>
        <ThemeProvider>
          <OrbitQueryProvider>
            <ChatRealtimeBridge />
            <RootLayoutNav />
          </OrbitQueryProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const layoutStyles = StyleSheet.create({
  flex: { flex: 1 },
});
