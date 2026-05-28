/**
 * Map Screen - Web Implementation
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { useOrbitTheme } from '../theme';
import { AppText } from '../ui/AppText';
import { UserCard } from '../components';
import { useLikeUserMutation, useNearbyUsersQuery, usePassUserMutation } from '../hooks/useOrbitApi';
import { useAuthStore } from '../stores';

export type MapScreenProps = {
  variant?: 'discover' | 'map';
};

export default function MapScreen({ variant = 'discover' }: MapScreenProps) {
  const { colors, fonts } = useOrbitTheme();
  const { user, updateLocation } = useAuthStore();
  const radius = user?.discovery_radius ?? 1000;
  const [loading, setLoading] = useState(true);
  const nearbyQuery = useNearbyUsersQuery(
    radius,
    user?.latitude,
    user?.longitude,
    !loading && user?.latitude != null && user?.longitude != null
  );
  const nearbyUsers = nearbyQuery.data?.users ?? [];
  const likeMut = useLikeUserMutation();
  const passMut = usePassUserMutation();

  useEffect(() => {
    initializeLocation();
  }, []);

  const initializeLocation = async () => {
    try {
      // Reuse stored location if we already have one.
      if (user?.latitude != null && user?.longitude != null) {
        setLoading(false);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      await updateLocation(location.coords.latitude, location.coords.longitude);
      setLoading(false);
    } catch (error) {
      console.error('Location error:', error);
      setLoading(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background.primary,
        },
        loadingContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        safeArea: {
          flex: 1,
        },
        header: {
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.xl,
          paddingBottom: Spacing.md,
        },
        headerTop: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: Spacing.lg,
        },
        brandPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.sm,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: BorderRadius.full,
          backgroundColor: colors.background.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
        },
        liveDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.online,
        },
        brandPillText: {
          color: colors.text.secondary,
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.semibold,
          fontFamily: fonts.semibold,
        },
        radiusPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: BorderRadius.full,
          backgroundColor: colors.primary.default + '18',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.primary.default + '33',
        },
        radiusText: {
          color: colors.primary.default,
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.semibold,
          fontFamily: fonts.semibold,
        },
        title: {
          fontSize: 34,
          lineHeight: 40,
          fontWeight: FontWeights.extrabold,
          color: colors.text.primary,
          fontFamily: fonts.extrabold,
          letterSpacing: 0,
        },
        subtitle: {
          marginTop: Spacing.sm,
          maxWidth: 560,
          color: colors.text.secondary,
          fontSize: FontSizes.md,
          lineHeight: 23,
          fontFamily: fonts.regular,
        },
        signalPanel: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.md,
          padding: Spacing.md,
          backgroundColor: colors.background.card,
          marginHorizontal: Spacing.lg,
          borderRadius: BorderRadius.lg,
          marginBottom: Spacing.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          ...Platform.select({
            web: {
              boxShadow: '0 16px 48px rgba(6,19,13,0.08)',
            } as any,
            default: {},
          }),
        },
        signalIcon: {
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary.default + '18',
        },
        signalCopy: {
          flex: 1,
        },
        signalTitle: {
          color: colors.text.primary,
          fontSize: FontSizes.md,
          fontWeight: FontWeights.semibold,
          fontFamily: fonts.semibold,
        },
        signalText: {
          marginTop: 2,
          color: colors.text.tertiary,
          fontSize: FontSizes.sm,
          lineHeight: 19,
          fontFamily: fonts.regular,
        },
        listContent: {
          paddingHorizontal: Spacing.lg,
          paddingBottom: 120,
          gap: Spacing.md,
        },
        empty: {
          minHeight: 260,
          marginTop: Spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: BorderRadius.xl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          backgroundColor: colors.background.card,
          padding: Spacing.xl,
        },
        emptyIcon: {
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background.tertiary,
          marginBottom: Spacing.md,
        },
        emptyTitle: {
          color: colors.text.primary,
          fontSize: FontSizes.xl,
          fontWeight: FontWeights.bold,
          fontFamily: fonts.bold,
          textAlign: 'center',
        },
        emptyText: {
          marginTop: Spacing.sm,
          color: colors.text.secondary,
          fontSize: FontSizes.sm,
          lineHeight: 20,
          textAlign: 'center',
          maxWidth: 320,
          fontFamily: fonts.regular,
        },
      }),
    [colors, fonts]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.default} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.brandPill}>
              <View style={styles.liveDot} />
              <AppText style={styles.brandPillText}>Nearby now</AppText>
            </View>
            <View style={styles.radiusPill}>
              <Ionicons name="navigate" size={14} color={colors.primary.default} />
              <AppText style={styles.radiusText}>{radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}</AppText>
            </View>
          </View>
          <AppText style={styles.title}>{variant === 'discover' ? 'Discover your orbit' : 'Map your orbit'}</AppText>
          <AppText style={styles.subtitle}>
            A calm read of people and plans close enough to become real.
          </AppText>
        </View>

        <View style={styles.signalPanel}>
          <View style={styles.signalIcon}>
            <Ionicons name="map-outline" size={22} color={colors.primary.default} />
          </View>
          <View style={styles.signalCopy}>
            <AppText style={styles.signalTitle}>Map preview</AppText>
            <AppText style={styles.signalText}>The native app renders the live interactive map; web keeps the nearby people queue polished and testable.</AppText>
          </View>
        </View>

        <FlatList
          data={nearbyUsers}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="radio-outline" size={28} color={colors.text.tertiary} />
              </View>
              <AppText style={styles.emptyTitle}>No one in range yet</AppText>
              <AppText style={styles.emptyText}>When nearby profiles appear, they will show up here with quick orbit actions.</AppText>
            </View>
          }
          renderItem={({ item }) => (
            <UserCard
              user={item}
              onLike={() => likeMut.mutate(item.id)}
              onPass={() => passMut.mutate(item.id)}
              onPress={() => router.push(`/user/${item.id}`)}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    </View>
  );
}
