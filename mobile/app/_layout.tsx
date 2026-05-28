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
import { usePresenceLifecycle } from '../src/hooks/usePresenceLifecycle';

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
  const { isLoading, loadUser, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();
  const [mounted, setMounted] = useState(false);
  const shouldTrackPresence = mounted && !isLoading && isAuthenticated;

  usePresenceLifecycle(shouldTrackPresence);

  useEffect(() => {
    setMounted(true);
    loadUser();
    installNotificationHandlerSafe();
  }, []);

  useEffect(() => {
    if (!mounted || isLoading) return;

    const topSegment = segments[0] as string | undefined;
    const inAuthGroup = topSegment === '(auth)';
    const inTabsGroup = topSegment === '(tabs)';
    const inChatStack = topSegment === 'chat';
    const inUserStack = topSegment === 'user';
    const inEventStack = topSegment === 'event';
    const inSearchStack = topSegment === 'search';
    const inMainApp = inTabsGroup || inChatStack || inUserStack || inEventStack || inSearchStack;

    if (!isAuthenticated) {
      if (inTabsGroup) router.replace('/');
    } else {
      // Don't redirect while still in the auth flow (signup completes its own navigation)
      if (!inMainApp && !inAuthGroup) router.replace('/(tabs)/feed');
    }
  }, [isAuthenticated, isLoading, mounted, segments, router]);

  useEffect(() => {
    if (!mounted || isLoading || !isAuthenticated) return undefined;

    void prepareNotificationEnvironment();

    let cancelled = false;
    void (async () => {
      const result = await tryRegisterExpoPushToken(
        async (token) => {
          if (cancelled) return;
          try {
            await authApi.registerExpoPushToken(token);
          } catch (e) {
            console.warn('[notifications] registerExpoPushToken API failed:', e);
            throw e;
          }
        },
        { isCancelled: () => cancelled }
      );

      if (cancelled) return;
      if (result.status === 'registered') {
        console.log('[notifications] Expo push token registered.');
      } else {
        console.warn(`[notifications] Expo push registration skipped: ${result.reason}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted, isLoading, isAuthenticated]);

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
