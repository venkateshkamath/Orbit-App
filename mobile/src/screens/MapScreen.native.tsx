/**
 * Map Screen - Native Implementation
 * Clean map styling (custom JSON on Google/Android, muted/dark on Apple Maps) + glass chrome.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
  Keyboard,
  InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { useNearbyUsersQuery, useNotificationsQuery } from '../hooks/useOrbitApi';
import { DiscoverNotificationsPanel } from '../components/DiscoverNotificationsPanel';
import { useAuthStore } from '../stores';
import { useOrbitTheme } from '../theme';
import { AppText } from '../ui/AppText';
import { googleMapStyleDark, googleMapStyleLight } from '../theme/mapStyles';

const DEFAULT_REGION: Region = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(109, 114, 250, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Stable pseudo-offset per user id (distance is meters from API). */
function markerCoordinate(
  id: string,
  baseLat: number,
  baseLng: number,
  distanceMeters: number
): { latitude: number; longitude: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(31, h) + id.charCodeAt(i);
  }
  const u = (h >>> 0) / 0xffff_ffff;
  const angle = u * 2 * Math.PI;
  const distKm = Math.max(distanceMeters || 100, 30) / 1000;
  const dist = distKm / 111;
  return {
    latitude: baseLat + dist * Math.cos(angle),
    longitude: baseLng + dist * Math.sin(angle),
  };
}

function formatDistanceMeters(m: number) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export type MapScreenProps = {
  variant?: 'discover' | 'map';
};

export default function MapScreen({ variant: _variant = 'discover' }: MapScreenProps) {
  const { colors, shadows, resolvedScheme, fonts } = useOrbitTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const mapRef = useRef<MapView>(null);
  const mapReadyRef = useRef(false);
  const iosCompassHideScheduledRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [locationError, setLocationError] = useState<string | null>(null);
  const { user, updateLocation } = useAuthStore();
  const radius = user?.discovery_radius ?? 1000;
  const nearbyQuery = useNearbyUsersQuery(
    radius,
    user?.latitude,
    user?.longitude,
    !loading && user?.latitude != null && user?.longitude != null
  );
  const nearbyUsers = nearbyQuery.data?.users ?? [];
  const nearbyOthers = useMemo(
    () => nearbyUsers.filter((u) => u.id !== user?.id),
    [nearbyUsers, user?.id]
  );
  const { data: notifData } = useNotificationsQuery();
  const unreadNotifCount = notifData?.unread_count ?? 0;

  const { refetch: refetchNearby } = nearbyQuery;

  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  /**
   * iOS MapKit + react-native-maps: `showsCompass={false}` runs before `MKCompassButton` is
   * created in `layoutSubviews`, so visibility never becomes hidden. Pulse true→false after
   * the map has laid out so the native setter runs when the overlay exists.
   */
  const [iosCompassPulse, setIosCompassPulse] = useState(false);

  const scheduleIosMapKitCompassHide = useCallback(() => {
    if (Platform.OS !== 'ios' || iosCompassHideScheduledRef.current) return;
    iosCompassHideScheduledRef.current = true;
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        setIosCompassPulse(true);
        setTimeout(() => setIosCompassPulse(false), 120);
      }, 320);
    });
  }, []);

  const isLight = resolvedScheme === 'light';
  const customMapStyle = useMemo(
    () => (isLight ? googleMapStyleLight : googleMapStyleDark),
    [isLight]
  );

  const radiusFill = useMemo(() => hexToRgba(colors.primary.default, 0.08), [colors.primary.default]);
  const radiusStroke = useMemo(() => hexToRgba(colors.primary.default, 0.28), [colors.primary.default]);

  /**
   * Tab bar is absolutely positioned over the map; padding bottom must include its measured
   * height so Google / Apple legal and controls stay above the glass dock.
   */
  const mapPadding = useMemo(() => {
    if (Platform.OS === 'ios') {
      return {
        top: insets.top + 12,
        right: 10,
        left: 10,
        bottom: 28 + tabBarHeight,
      };
    }
    return {
      top: insets.top + 56,
      right: 10,
      left: 16,
      bottom: 44 + tabBarHeight,
    };
  }, [insets.top, tabBarHeight]);

  /** iOS: nudge MKAttributionLabel (“Legal”) to bottom-leading inside the map view. */
  const legalLabelInsets = useMemo(() => {
    if (Platform.OS !== 'ios') {
      return undefined;
    }
    return {
      top: 0,
      left: 10,
      right: 0,
      bottom: 14 + tabBarHeight,
    };
  }, [tabBarHeight]);

  useFocusEffect(
    useCallback(() => {
      if (user?.latitude == null || user?.longitude == null) return;
      void refetchNearby();
    }, [user?.latitude, user?.longitude, refetchNearby])
  );

  const prevServerCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (user?.latitude == null || user?.longitude == null) return;
    const lat = user.latitude;
    const lng = user.longitude;
    const prev = prevServerCoordsRef.current;
    if (prev && prev.lat === lat && prev.lng === lng) return;
    if (prev == null) {
      prevServerCoordsRef.current = { lat, lng };
      return;
    }
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    locationDebounceRef.current = setTimeout(() => {
      locationDebounceRef.current = null;
      void refetchNearby();
    }, 1500);
    prevServerCoordsRef.current = { lat, lng };
    return () => {
      if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    };
  }, [user?.latitude, user?.longitude, refetchNearby]);

  useEffect(() => {
    initializeLocation();
  }, []);

  /**
   * Nearby discovery uses `user` lat/lng from the API/store (SessionLocationSync, updateLocation).
   * Marker positions are derived from local `userLocation`; if those diverge, the pill can show
   * matches while pins sit off the visible map or under incorrect zoom.
   */
  useEffect(() => {
    const lat = user?.latitude;
    const lng = user?.longitude;
    if (lat == null || lng == null) return;
    const next = { latitude: Number(lat), longitude: Number(lng) };
    if (!Number.isFinite(next.latitude) || !Number.isFinite(next.longitude)) return;
    setUserLocation((prev) => {
      if (
        prev &&
        Math.abs(prev.latitude - next.latitude) < 1e-8 &&
        Math.abs(prev.longitude - next.longitude) < 1e-8
      ) {
        return prev;
      }
      return next;
    });
  }, [user?.latitude, user?.longitude]);

  const initializeLocation = async () => {
    try {
      if (user?.latitude != null && user?.longitude != null) {
        const coords = { latitude: user.latitude, longitude: user.longitude };
        setUserLocation(coords);
        setLoading(false);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission required');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(coords);
      await updateLocation(coords.latitude, coords.longitude);
      setLoading(false);
    } catch (error) {
      console.error('Location error:', error);
      setLocationError('Could not get position');
      setLoading(false);
    }
  };

  const centerOnUser = useCallback(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion(
        {
          ...userLocation,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    }
  }, [userLocation]);

  const initialRegion = useMemo((): Region => {
    if (userLocation) {
      return {
        ...userLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return DEFAULT_REGION;
  }, [userLocation]);

  useEffect(() => {
    if (!userLocation || !mapRef.current || !mapReadyRef.current) return;
    mapRef.current.animateToRegion(
      {
        ...userLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      300
    );
  }, [userLocation]);

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
        map: {
          ...StyleSheet.absoluteFillObject,
        },
        mapSlot: {
          flex: 1,
          width: '100%',
          position: 'relative',
        },
        topChrome: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingHorizontal: Spacing.md,
          paddingTop: Platform.OS === 'android' ? 6 : 4,
        },
        topRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        },
        topRowCluster: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        mapControlBtn: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : colors.glass.background,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadows.sm,
        },
        badgeDot: {
          position: 'absolute',
          top: 6,
          right: 6,
          minWidth: 16,
          height: 16,
          paddingHorizontal: 4,
          borderRadius: 8,
          backgroundColor: colors.error,
          alignItems: 'center',
          justifyContent: 'center',
        },
        badgeText: {
          color: '#fff',
          fontSize: 10,
          fontWeight: '700',
          fontFamily: fonts.bold,
        },
        nearbyPill: {
          alignSelf: 'flex-end',
          marginTop: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: BorderRadius.full,
          backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : colors.glass.background,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          ...shadows.sm,
        },
        nearbyDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.success,
        },
        nearbyPillText: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.text.primary,
          fontFamily: fonts.semibold,
        },
        recenterWrap: {
          position: 'absolute',
          right: Spacing.md,
          bottom: 18,
          alignItems: 'flex-end',
        },
        recenterButton: {
          width: 52,
          height: 52,
          borderRadius: 26,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isLight ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.14)',
          ...shadows.lg,
        },
        recenterGrad: {
          ...StyleSheet.absoluteFillObject,
        },
        modalCard: {
          marginHorizontal: Spacing.lg,
          padding: Spacing.lg,
          borderRadius: BorderRadius.lg,
          backgroundColor: colors.background.elevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
        },
        modalTitle: {
          fontSize: FontSizes.lg,
          fontWeight: FontWeights.bold,
          color: colors.text.primary,
          marginBottom: 8,
          fontFamily: fonts.bold,
        },
        modalBody: {
          fontSize: FontSizes.sm,
          color: colors.text.secondary,
          lineHeight: 20,
          fontFamily: fonts.regular,
        },
        modalInput: {
          marginTop: 12,
          padding: 12,
          borderRadius: BorderRadius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          color: colors.text.primary,
          backgroundColor: colors.background.secondary,
          fontFamily: fonts.regular,
        },
        modalBtn: {
          marginTop: 16,
          paddingVertical: 12,
          borderRadius: BorderRadius.md,
          backgroundColor: colors.primary.default,
          alignItems: 'center',
        },
        modalBtnText: {
          color: '#fff',
          fontWeight: '600',
          fontSize: FontSizes.md,
          fontFamily: fonts.semibold,
        },
        markerLetterOuter: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.background.elevated,
          borderWidth: 2,
          borderColor: colors.primary.default,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadows.sm,
        },
        markerLetterText: {
          fontSize: FontSizes.sm,
          fontWeight: FontWeights.bold,
          color: colors.text.primary,
          fontFamily: fonts.bold,
        },
      }),
    [colors, shadows, isLight, fonts]
  );

  function InitialMarker({ username }: { username: string }) {
    const letter = (username?.trim()?.[0] || '?').toUpperCase();
    return (
      <View style={styles.markerLetterOuter} collapsable={false}>
        <AppText style={styles.markerLetterText}>{letter}</AppText>
      </View>
    );
  }

  const nearbyLabel =
    nearbyOthers.length >= 100 ? '100+ nearby' : `${nearbyOthers.length} orbitter`;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary.default} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapSlot} collapsable={false}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          customMapStyle={Platform.OS === 'android' ? customMapStyle : undefined}
          mapType={Platform.OS === 'ios' ? (isLight ? 'mutedStandard' : 'standard') : 'standard'}
          userInterfaceStyle={Platform.OS === 'ios' ? resolvedScheme : undefined}
          showsUserLocation={!!userLocation}
          followsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={Platform.OS === 'ios' ? iosCompassPulse : false}
          showsScale={false}
          showsIndoorLevelPicker={false}
          loadingEnabled={Platform.OS === 'android'}
          initialRegion={initialRegion}
          mapPadding={mapPadding}
          legalLabelInsets={legalLabelInsets}
          showsPointsOfInterest={Platform.OS === 'ios' ? false : undefined}
          poiClickEnabled={Platform.OS === 'android' ? false : undefined}
          toolbarEnabled={Platform.OS === 'android' ? false : undefined}
          onMapReady={() => {
            mapReadyRef.current = true;
            if (userLocation) {
              mapRef.current?.animateToRegion(
                {
                  ...userLocation,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                },
                0
              );
            }
            scheduleIosMapKitCompassHide();
          }}
        >
          {userLocation && Platform.OS !== 'android' ? (
            <Circle
              center={userLocation}
              radius={radius}
              fillColor={radiusFill}
              strokeColor={radiusStroke}
              strokeWidth={1.5}
            />
          ) : null}

          {userLocation &&
            nearbyOthers.map((u) => {
              const coord = markerCoordinate(
                u.id,
                userLocation.latitude,
                userLocation.longitude,
                u.distance || 100
              );

              return (
                <Marker
                  key={u.id}
                  coordinate={coord}
                  anchor={{ x: 0.5, y: 0.5 }}
                  zIndex={2}
                  tracksViewChanges={Platform.OS === 'android'}
                  onPress={() => router.push(`/user/${u.id}`)}
                >
                  <InitialMarker username={u.username} />
                </Marker>
              );
            })}
        </MapView>
      </View>

      <View style={[styles.topChrome, { paddingTop: insets.top + 4 }]} pointerEvents="box-none">
        <View style={styles.topRow}>
          <View style={styles.topRowCluster}>
            <Pressable
              onPress={() => setSearchOpen(true)}
              style={({ pressed }) => [styles.mapControlBtn, pressed && { opacity: 0.88 }]}
              accessibilityLabel="Search"
            >
              <Ionicons name="search" size={22} color={colors.text.primary} />
            </Pressable>
            <Pressable
              onPress={() => setFilterOpen(true)}
              style={({ pressed }) => [styles.mapControlBtn, pressed && { opacity: 0.88 }]}
              accessibilityLabel="Filters"
            >
              <Ionicons name="options" size={22} color={colors.text.primary} />
            </Pressable>
          </View>
          <View style={styles.topRowCluster}>
            <Pressable
              onPress={() => setNotifOpen(true)}
              style={({ pressed }) => [styles.mapControlBtn, pressed && { opacity: 0.88 }]}
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={22} color={colors.text.primary} />
              {unreadNotifCount > 0 ? (
                <View style={styles.badgeDot}>
                  <AppText style={styles.badgeText}>
                    {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/chat')}
              style={({ pressed }) => [styles.mapControlBtn, pressed && { opacity: 0.88 }]}
              accessibilityLabel="Chats"
            >
              <Ionicons name="people-outline" size={22} color={colors.text.primary} />
            </Pressable>
          </View>
        </View>
        {nearbyOthers.length > 0 ? (
          <Pressable
            onPress={() => void refetchNearby()}
            style={({ pressed }) => [styles.nearbyPill, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.nearbyDot} />
            <AppText style={styles.nearbyPillText}>{nearbyLabel}</AppText>
          </Pressable>
        ) : null}
        {locationError ? (
          <AppText
            style={{
              marginTop: 8,
              fontSize: 11,
              color: colors.error,
              paddingHorizontal: 4,
              fontFamily: fonts.medium,
            }}
          >
            {locationError}
          </AppText>
        ) : null}
      </View>

      <View style={[styles.recenterWrap, { bottom: 18 + tabBarHeight }]} pointerEvents="box-none">
        <Pressable
          onPress={centerOnUser}
          accessibilityLabel="Center map on my location"
          android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
          style={({ pressed }) => [styles.recenterButton, pressed && { opacity: 0.92 }]}
        >
          <LinearGradient
            colors={[colors.primary.light, colors.primary.default]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.recenterGrad}
          />
          <Ionicons name="navigate" size={24} color="#FFFFFF" style={{ transform: [{ rotate: '-42deg' }] }} />
        </Pressable>
      </View>

      <DiscoverNotificationsPanel visible={notifOpen} onClose={() => setNotifOpen(false)} />

      <Modal visible={searchOpen} animationType="fade" transparent onRequestClose={() => setSearchOpen(false)}>
        <Pressable
          style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.overlay }]}
          onPress={() => {
            Keyboard.dismiss();
            setSearchOpen(false);
          }}
        >
          <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.lg }}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalCard}>
                <AppText style={styles.modalTitle}>Search</AppText>
                <AppText style={styles.modalBody}>
                  Find people by name or interests — this will be available in a future update.
                </AppText>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Search people…"
                  placeholderTextColor={colors.text.tertiary}
                  editable={false}
                />
                <Pressable style={styles.modalBtn} onPress={() => setSearchOpen(false)}>
                  <AppText style={styles.modalBtnText}>OK</AppText>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={filterOpen} animationType="fade" transparent onRequestClose={() => setFilterOpen(false)}>
        <Pressable
          style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.overlay }]}
          onPress={() => setFilterOpen(false)}
        >
          <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.lg }}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalCard}>
                <AppText style={styles.modalTitle}>Discovery radius</AppText>
                <AppText style={styles.modalBody}>
                  Your map uses a {formatDistanceMeters(radius)} radius. Change it anytime from your profile.
                </AppText>
                <Pressable
                  style={styles.modalBtn}
                  onPress={() => {
                    setFilterOpen(false);
                    router.push('/(tabs)/profile');
                  }}
                >
                  <AppText style={styles.modalBtnText}>Open profile</AppText>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, { marginTop: 10, backgroundColor: colors.background.tertiary }]}
                  onPress={() => setFilterOpen(false)}
                >
                  <AppText style={[styles.modalBtnText, { color: colors.text.primary }]}>Close</AppText>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
