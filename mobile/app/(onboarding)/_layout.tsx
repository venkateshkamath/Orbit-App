/**
 * Onboarding Layout
 */

import { Stack } from 'expo-router';
import { useOrbitTheme } from '../../src/theme';

export default function OnboardingLayout() {
  const { colors } = useOrbitTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
      }}
    />
  );
}
