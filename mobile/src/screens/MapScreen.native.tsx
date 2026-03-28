/**
 * Map Screen - Native Implementation
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { useNearbyUsersQuery } from '../hooks/useOrbitApi';
import { useAuthStore } from '../stores';

const DEFAULT_REGION: Region = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

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

function InitialMarker({ username }: { username: string }) {
  const letter = (username?.trim()?.[0] || '?').toUpperCase();
  return (
    <View style={styles.markerLetterOuter} collapsable={false}>
      <Text style={styles.markerLetterText}>{letter}</Text>
    </View>
  );
}

export type MapScreenProps = {
  variant?: 'discover' | 'map';
};

export default function MapScreen({ variant = 'discover' }: MapScreenProps) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const mapReadyRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
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

  /** Android: allow markers to repaint while images load, then turn off to avoid blank/glitched custom views. */
  const [androidMarkersSettled, setAndroidMarkersSettled] = useState(
    Platform.OS !== 'android'
  );

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
      // If we already have a stored location for this user, reuse it without prompting again.
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

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary.default} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/*
        Map sizing: flex:1 on MapView alone can resolve to 0 height inside tab navigators.
        Slot uses flex:1; MapView uses absoluteFill so it always fills the slot.
        customMapStyle is Google Maps JSON only — do not pass it on iOS (Apple MapKit) or the map can fail.
      */}
      <View style={styles.mapSlot} collapsable={false}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          showsUserLocation={!!userLocation}
          followsUserLocation={false}
          loadingEnabled={Platform.OS === 'android'}
          initialRegion={initialRegion}
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
              fillColor="rgba(139, 92, 246, 0.1)"
              strokeColor="rgba(139, 92, 246, 0.3)"
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

      <SafeAreaView style={styles.headerOverlay} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>{variant === 'discover' ? 'Discover' : 'Map'}</Text>
          <Text style={styles.subtitle}>
            {formatDistanceMeters(radius)} range · tap a pin to view their profile
          </Text>
        </View>
      </SafeAreaView>

      <TouchableOpacity style={styles.centerButton} onPress={centerOnUser}>
        <Ionicons name="locate" size={24} color={Colors.primary.default} />
      </TouchableOpacity>

    </View>
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
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapSlot: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  header: {
    padding: Spacing.lg,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: FontSizes.sm,
    color: Colors.text.tertiary,
    lineHeight: 18,
  },
  centerButton: {
    position: 'absolute',
    bottom: 120,
    right: Spacing.lg,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  markerLetterOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background.secondary,
    borderWidth: 2,
    borderColor: Colors.primary.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerLetterText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
  },
});
