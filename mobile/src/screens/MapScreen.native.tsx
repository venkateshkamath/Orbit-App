/**
 * Map Screen - Native Implementation
 * Clean map styling (custom JSON on Google/Android, muted/dark on Apple Maps) + glass chrome.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { useNearbyUsersQuery } from '../hooks/useOrbitApi';
import { useAuthStore } from '../stores';
import { useOrbitTheme } from '../theme';
import { googleMapStyleDark, googleMapStyleLight } from '../theme/mapStyles';

const DEFAULT_REGION: Region = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(109, 90, 230, ${alpha})`;
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

export default function MapScreen({ variant = 'discover' }: MapScreenProps) {
  const { colors, shadows, resolvedScheme } = useOrbitTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const mapReadyRef = useRef(false);
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

  const { refetch: refetchNearby } = nearbyQuery;

  const isLight = resolvedScheme === 'light';
  const customMapStyle = useMemo(
    () => (isLight ? googleMapStyleLight : googleMapStyleDark),
    [isLight]
  );

  const radiusFill = useMemo(() => hexToRgba(colors.primary.default, 0.08), [colors.primary.default]);
  const radiusStroke = useMemo(() => hexToRgba(colors.primary.default, 0.28), [colors.primary.default]);

  /** Compact header + floating tab bar */
  const mapPadding = useMemo(
    () => ({
      top: insets.top + 62,
      right: 10,
      left: 10,
      bottom: Math.max(insets.bottom, 10) + 100,
    }),
    [insets.top, insets.bottom]
  );

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

  const [androidMarkersSettled, setAndroidMarkersSettled] = useState(Platform.OS !== 'android');

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    setAndroidMarkersSettled(false);
    const t = setTimeout(() => setAndroidMarkersSettled(true), 1500);
    return () => clearTimeout(t);
  }, [nearbyUsers]);

  useEffect(() => {
    initializeLocation();
  }, []);

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
        headerSafe: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          paddingHorizontal: Spacing.md,
          paddingTop: Platform.OS === 'android' ? 8 : 4,
          alignItems: 'flex-start',
        },
        headerChip: {
          maxWidth: '86%',
          paddingVertical: 9,
          paddingHorizontal: 13,
          borderRadius: BorderRadius.md + 2,
          backgroundColor: isLight ? 'rgba(255,255,255,0.94)' : colors.background.elevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          ...shadows.sm,
        },
        headerTitle: {
          fontSize: 19,
          fontWeight: '700',
          color: colors.text.primary,
          letterSpacing: -0.35,
        },
        headerHint: {
          marginTop: 2,
          fontSize: 12,
          color: colors.text.tertiary,
          lineHeight: 16,
        },
        locateWrap: {
          position: 'absolute',
          right: Spacing.md,
        },
        locateButton: {
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: colors.background.elevated,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadows.sm,
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
        },
      }),
    [colors, shadows, isLight]
  );

  function InitialMarker({ username }: { username: string }) {
    const letter = (username?.trim()?.[0] || '?').toUpperCase();
    return (
      <View style={styles.markerLetterOuter} collapsable={false}>
        <Text style={styles.markerLetterText}>{letter}</Text>
      </View>
    );
  }

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
          loadingEnabled={Platform.OS === 'android'}
          initialRegion={initialRegion}
          mapPadding={mapPadding}
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
          }}
        >
          {userLocation && (
            <Circle
              center={userLocation}
              radius={radius}
              fillColor={radiusFill}
              strokeColor={radiusStroke}
              strokeWidth={1.5}
            />
          )}

          {userLocation &&
            nearbyUsers.map((u) => {
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
                  tracksViewChanges={Platform.OS === 'ios' || !androidMarkersSettled}
                  onPress={() => router.push(`/user/${u.id}`)}
                >
                  <InitialMarker username={u.username} />
                </Marker>
              );
            })}
        </MapView>
      </View>

      <SafeAreaView style={styles.headerSafe} edges={['top']} pointerEvents="box-none">
        <View style={styles.headerChip}>
          <Text style={styles.headerTitle}>{variant === 'discover' ? 'Discover' : 'Map'}</Text>
          <Text style={styles.headerHint}>
            {formatDistanceMeters(radius)} around you · tap a pin for their profile
          </Text>
          {locationError ? (
            <Text style={{ marginTop: 6, fontSize: 11, color: colors.error }}>{locationError}</Text>
          ) : null}
        </View>
      </SafeAreaView>

      <View style={[styles.locateWrap, { bottom: 100 + insets.bottom }]}>
        <Pressable
          onPress={centerOnUser}
          accessibilityLabel="Center map on my location"
          android_ripple={{ color: hexToRgba(colors.primary.default, 0.12) }}
          style={({ pressed }) => [styles.locateButton, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="locate" size={22} color={colors.primary.default} />
        </Pressable>
      </View>
    </View>
  );
}
