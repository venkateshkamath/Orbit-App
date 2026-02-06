/**
 * MindLink - Root Layout
 * Handles authentication routing
 */

import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../src/stores';
import { Colors } from '../constants/Colors';

function RootLayoutNav() {
  const { isLoading, loadUser, isAuthenticated, isOnboardingComplete } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadUser();
  }, []);

  useEffect(() => {
    if (!mounted || isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const inTabsGroup = segments[0] === '(tabs)';

    console.log('Auth state:', { isAuthenticated, isOnboardingComplete, segments });

    // Redirect logic
    if (!isAuthenticated) {
      // Not authenticated - should be on welcome or auth screens
      if (inTabsGroup || inOnboardingGroup) {
        console.log('Redirecting to welcome');
        router.replace('/');
      }
    } else if (!isOnboardingComplete) {
      // Authenticated but needs onboarding
      if (!inOnboardingGroup) {
        console.log('Redirecting to onboarding');
        router.replace('/(onboarding)/interests');
      }
    } else {
      // Fully authenticated - go to main app
      if (!inTabsGroup) {
        console.log('Redirecting to main app');
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, isOnboardingComplete, isLoading, mounted, segments, router]);

  if (isLoading || !mounted) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={Colors.primary.default} />
        <Text style={styles.loadingText}>Loading MindLink...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <RootLayoutNav />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
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
