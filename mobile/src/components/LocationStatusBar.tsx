import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../constants/Colors';
import { useLocationContext } from '../context/LocationContext';

function formatCoord(n: number) {
  return n.toFixed(6);
}

export function LocationStatusBar() {
  const { fix, permissionDenied, error, isTracking, requestPermissionAgain } = useLocationContext();
  const insets = useSafeAreaInsets();

  const openSettings = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Linking.openSettings();
    }
  };

  if (permissionDenied) {
    return (
      <View style={[styles.wrap, { paddingTop: Math.max(insets.top, Spacing.xs) }]}>
        <Pressable
          style={styles.row}
          onPress={requestPermissionAgain}
          android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
        >
          <Ionicons name="close-circle" size={16} color={Colors.error} />
          <Text style={styles.warnText}>
            Location access needed — tap to allow while using ORBIT
          </Text>
        </Pressable>
        {(Platform.OS === 'ios' || Platform.OS === 'android') && (
          <Pressable onPress={openSettings} style={styles.settingsLink}>
            <Text style={styles.settingsText}>Open system settings</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (error && !fix) {
    return (
      <View style={[styles.wrap, { paddingTop: Math.max(insets.top, Spacing.xs) }]}>
        <Text style={styles.warnText} numberOfLines={2}>
          {error}
        </Text>
      </View>
    );
  }

  if (!fix) {
    return (
      <View style={[styles.wrap, { paddingTop: Math.max(insets.top, Spacing.xs) }]}>
        <View style={styles.row}>
          <ActivityDot active={isTracking} />
          <Text style={styles.muted}>Getting your precise location…</Text>
        </View>
      </View>
    );
  }

  const acc =
    fix.accuracy != null && Number.isFinite(fix.accuracy)
      ? ` ±${Math.round(fix.accuracy)}m`
      : '';

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, Spacing.xs) }]}>
      <View style={styles.row}>
        <ActivityDot active={isTracking} />
        <Ionicons name="navigate" size={14} color={Colors.primary.default} style={styles.iconGap} />
        <Text style={styles.coords} selectable>
          {formatCoord(fix.latitude)}, {formatCoord(fix.longitude)}
        </Text>
        <Text style={styles.accuracy}>{acc}</Text>
      </View>
      <Text style={styles.hint}>Updates while the app is open · synced to your profile for discovery</Text>
    </View>
  );
}

function ActivityDot({ active }: { active: boolean }) {
  return (
    <View style={[styles.dotOuter, active && styles.dotOuterActive]}>
      <View style={[styles.dot, active && styles.dotActive]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.background.secondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  coords: {
    color: Colors.text.primary,
    fontSize: FontSizes.sm,
    fontVariant: ['tabular-nums'],
  },
  accuracy: {
    color: Colors.text.tertiary,
    fontSize: FontSizes.xs,
  },
  muted: {
    color: Colors.text.secondary,
    fontSize: FontSizes.sm,
  },
  hint: {
    color: Colors.text.muted,
    fontSize: 11,
    marginTop: 4,
  },
  warnText: {
    color: Colors.text.secondary,
    fontSize: FontSizes.sm,
    flex: 1,
  },
  settingsLink: {
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
  },
  settingsText: {
    color: Colors.primary.default,
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  iconGap: {
    marginRight: 2,
  },
  dotOuter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.text.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOuterActive: {
    borderColor: Colors.primary.default,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.text.tertiary,
  },
  dotActive: {
    backgroundColor: Colors.primary.default,
  },
});

export default LocationStatusBar;
