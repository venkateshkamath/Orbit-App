import { useMemo } from 'react';
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useOrbitTheme } from '../src/theme';

export default function NotFoundScreen() {
  const { colors } = useOrbitTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          backgroundColor: colors.background.primary,
        },
        title: {
          fontSize: 20,
          fontWeight: 'bold',
          color: colors.text.primary,
        },
        link: {
          marginTop: 15,
          paddingVertical: 15,
        },
        linkText: {
          fontSize: 14,
          color: colors.primary.default,
        },
      }),
    [colors]
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}
