/**
 * Auth Layout
 */

import { Stack } from 'expo-router';
import { useOrbitTheme } from '../../src/theme';

export default function AuthLayout() {
  const { colors } = useOrbitTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.primary },
        animation: 'slide_from_right',
      }}
    />
  );
}
