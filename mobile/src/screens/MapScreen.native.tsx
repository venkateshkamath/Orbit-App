/**
 * Map Screen - Native Implementation
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
  Image,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { useNearbyUsersQuery, useNotificationsQuery, useNearbyEventsQuery, useDeleteEventMutation } from '../hooks/useOrbitApi';
import { DiscoverNotificationsPanel } from '../components/DiscoverNotificationsPanel';
import { CreateEventModal, EVENT_CATEGORY_META } from '../components/CreateEventModal';
import { useAuthStore } from '../stores';
import { useOrbitTheme } from '../theme';
import { AppText } from '../ui/AppText';
import { googleMapStyleDark, googleMapStyleLight } from '../theme/mapStyles';
import type { OrbitEvent } from '../types';

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

function stableHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(31, h) + id.charCodeAt(i);
  }
  return (h >>> 0) / 0xffff_ffff;
}

function markerCoordinate(
  id: string,
  baseLat: number,
  baseLng: number,
  distanceMeters: number
): { latitude: number; longitude: number } {
  const u = stableHash(id);
  const angle = u * 2 * Math.PI;
  const distKm = Math.max(distanceMeters || 100, 30) / 1000;
  const dist = distKm / 111;
  return {
    latitude: baseLat + dist * Math.cos(angle),
    longitude: baseLng + dist * Math.sin(angle),
  };
}

/** Spread event markers so overlapping pins are clearly separated (~80 m radius). */
function eventMarkerCoordinate(
  id: string,
  lat: number,
  lng: number
): { latitude: number; longitude: number } {
  const u = stableHash(id);
  const angle = u * 2 * Math.PI;
  const SPREAD = 0.0008; // ~88 m in degrees lat — clearly visible at normal zoom
  return {
    latitude:  lat  + SPREAD * Math.sin(angle),
    longitude: lng  + SPREAD * Math.cos(angle),
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
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<OrbitEvent | null>(null);
  const cardAnim = useRef(new Animated.Value(0)).current;

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

  const [notifOpen, setNotifOpen]         = useState(false);
  const [searchOpen, setSearchOpen]       = useState(false);
  const [filterOpen, setFilterOpen]       = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);

  const eventsQuery = useNearbyEventsQuery(
    user?.latitude,
    user?.longitude,
    radius,
    !loading && user?.latitude != null && user?.longitude != null,
  );
  const nearbyEvents = eventsQuery.data?.events ?? [];
  const deleteEventMutation = useDeleteEventMutation();

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
  const customMapStyle = useMemo(() => (isLight ? googleMapStyleLight : googleMapStyleDark), [isLight]);
  const radiusFill = useMemo(() => hexToRgba(colors.primary.default, 0.08), [colors.primary.default]);
  const radiusStroke = useMemo(() => hexToRgba(colors.primary.default, 0.28), [colors.primary.default]);

  const mapPadding = useMemo(() => {
    if (Platform.OS === 'ios') return { top: insets.top + 12, right: 10, left: 10, bottom: 28 + tabBarHeight };
    return { top: insets.top + 56, right: 10, left: 16, bottom: 44 + tabBarHeight };
  }, [insets.top, tabBarHeight]);

  const legalLabelInsets = useMemo(() => {
    if (Platform.OS !== 'ios') return undefined;
    return { top: 0, left: 10, right: 0, bottom: 14 + tabBarHeight };
  }, [tabBarHeight]);

  /* show/hide event card */
  const showEventCard = useCallback((event: OrbitEvent) => {
    setSelectedEvent(event);
    Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }).start();
  }, [cardAnim]);

  const hideEventCard = useCallback(() => {
    Animated.timing(cardAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setSelectedEvent(null);
    });
  }, [cardAnim]);

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
    if (prev == null) { prevServerCoordsRef.current = { lat, lng }; return; }
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
    locationDebounceRef.current = setTimeout(() => {
      locationDebounceRef.current = null;
      void refetchNearby();
    }, 1500);
    prevServerCoordsRef.current = { lat, lng };
    return () => { if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current); };
  }, [user?.latitude, user?.longitude, refetchNearby]);

  useEffect(() => { initializeLocation(); }, []);

  useEffect(() => {
    const lat = user?.latitude;
    const lng = user?.longitude;
    if (lat == null || lng == null) return;
    const next = { latitude: Number(lat), longitude: Number(lng) };
    if (!Number.isFinite(next.latitude) || !Number.isFinite(next.longitude)) return;
    setUserLocation((prev) => {
      if (prev && Math.abs(prev.latitude - next.latitude) < 1e-8 && Math.abs(prev.longitude - next.longitude) < 1e-8) return prev;
      return next;
    });
  }, [user?.latitude, user?.longitude]);

  const initializeLocation = async () => {
    try {
      if (user?.latitude != null && user?.longitude != null) {
        setUserLocation({ latitude: user.latitude, longitude: user.longitude });
        setLoading(false);
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationError('Location permission required'); setLoading(false); return; }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
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
      mapRef.current.animateToRegion({ ...userLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    }
  }, [userLocation]);

  const initialRegion = useMemo((): Region => {
    if (userLocation) return { ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 };
    return DEFAULT_REGION;
  }, [userLocation]);

  useEffect(() => {
    if (!userLocation || !mapRef.current || !mapReadyRef.current) return;
    mapRef.current.animateToRegion({ ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 300);
  }, [userLocation]);

  const handleDeleteEvent = (event: OrbitEvent) => {
    Alert.alert(`Delete "${event.title}"?`, 'This will remove the event from the map.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          hideEventCard();
          deleteEventMutation.mutate(event.id, {
            onSuccess: () => eventsQuery.refetch(),
          });
        }
      },
    ]);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background.primary },
        loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
        map: { ...StyleSheet.absoluteFillObject },
        mapSlot: { flex: 1, width: '100%', position: 'relative' },

        /* top chrome */
        topChrome: {
          position: 'absolute', top: 0, left: 0, right: 0,
          paddingHorizontal: Spacing.md,
          paddingTop: Platform.OS === 'android' ? 6 : 4,
        },
        topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
        topRowCluster: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        mapControlBtn: {
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : colors.glass.background,
          borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderLight,
          alignItems: 'center', justifyContent: 'center', ...shadows.sm,
        },
        badgeDot: {
          position: 'absolute', top: 6, right: 6,
          minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8,
          backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center',
        },
        badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', fontFamily: fonts.bold },
        nearbyPill: {
          alignSelf: 'flex-end', marginTop: 10,
          flexDirection: 'row', alignItems: 'center', gap: 8,
          paddingVertical: 8, paddingHorizontal: 14, borderRadius: BorderRadius.full,
          backgroundColor: isLight ? 'rgba(255,255,255,0.95)' : colors.glass.background,
          borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderLight, ...shadows.sm,
        },
        nearbyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
        nearbyPillText: { fontSize: 13, fontWeight: '600', color: colors.text.primary, fontFamily: fonts.semibold },

        /* fab cluster */
        fabWrap: { position: 'absolute', right: Spacing.md, alignItems: 'flex-end' },
        fabBtn: {
          width: 52, height: 52, borderRadius: 26, overflow: 'hidden',
          alignItems: 'center', justifyContent: 'center',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isLight ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.14)',
          ...shadows.lg,
        },
        fabGrad: { ...StyleSheet.absoluteFillObject },

        /* user marker */
        markerLetterOuter: {
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: colors.background.elevated,
          borderWidth: 2, borderColor: colors.primary.default,
          alignItems: 'center', justifyContent: 'center', ...shadows.sm,
        },
        markerLetterText: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold, color: colors.text.primary, fontFamily: fonts.bold },

        /* event marker */
        eventMarkerOuter: {
          width: 44, height: 44, borderRadius: 22,
          borderWidth: 2.5, borderColor: '#FFFFFF',
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...shadows.md,
        },
        eventMarkerGrad: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
        eventMarkerImage: { width: '100%', height: '100%' },

        /* event detail card */
        eventCardBackdrop: {
          position: 'absolute', left: 0, right: 0, bottom: 0, top: 0,
        },
        eventCard: {
          position: 'absolute',
          left: Spacing.md,
          right: Spacing.md,
          backgroundColor: colors.background.card,
          borderRadius: 20,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderLight,
          padding: Spacing.lg,
          ...shadows.lg,
        },
        eventCardHandle: {
          width: 32, height: 3, borderRadius: 2,
          backgroundColor: colors.borderLight,
          alignSelf: 'center', marginBottom: Spacing.md,
        },
        eventCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
        eventCardIconWrap: {
          width: 48, height: 48, borderRadius: 14, overflow: 'hidden',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        },
        eventCardIconGrad: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
        eventCardIconImage: { width: '100%', height: '100%' },
        eventCardInfo: { flex: 1 },
        eventCardTitle: {
          fontSize: FontSizes.md, fontWeight: '700',
          color: colors.text.primary, fontFamily: fonts.bold,
          letterSpacing: 0, marginBottom: 4,
        },
        eventCardMeta: {
          fontSize: FontSizes.sm, color: colors.text.secondary,
          fontFamily: fonts.regular, lineHeight: 18,
        },
        eventCardCategoryBadge: {
          flexDirection: 'row', alignItems: 'center', gap: 4,
          marginTop: 6, alignSelf: 'flex-start',
          paddingHorizontal: 8, paddingVertical: 3,
          borderRadius: BorderRadius.full,
          backgroundColor: colors.primary.default + '22',
        },
        eventCardCategoryText: {
          fontSize: 11, color: colors.primary.dark,
          fontFamily: fonts.semibold, textTransform: 'capitalize',
        },
        eventCardClose: {
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: colors.background.elevated,
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        },
        eventCardActions: {
          flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md,
        },
        eventCardDeleteBtn: {
          flex: 1, paddingVertical: 10, borderRadius: BorderRadius.md,
          backgroundColor: colors.error + '18',
          borderWidth: 1, borderColor: colors.error + '40',
          alignItems: 'center',
        },
        eventCardDeleteText: {
          color: colors.error, fontSize: FontSizes.sm,
          fontFamily: fonts.semibold, fontWeight: '600',
        },

        /* modals */
        modalCard: {
          marginHorizontal: Spacing.lg, padding: Spacing.lg, borderRadius: BorderRadius.lg,
          backgroundColor: colors.background.elevated,
          borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderLight,
        },
        modalTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: colors.text.primary, marginBottom: 8, fontFamily: fonts.bold },
        modalBody: { fontSize: FontSizes.sm, color: colors.text.secondary, lineHeight: 20, fontFamily: fonts.regular },
        modalInput: {
          marginTop: 12, padding: 12, borderRadius: BorderRadius.md,
          borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
          color: colors.text.primary, backgroundColor: colors.background.secondary, fontFamily: fonts.regular,
        },
        modalBtn: {
          marginTop: 16, paddingVertical: 12, borderRadius: BorderRadius.md,
          backgroundColor: colors.primary.default, alignItems: 'center',
        },
        modalBtnText: { color: colors.text.primary, fontWeight: '600', fontSize: FontSizes.md, fontFamily: fonts.semibold },
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

  function EventMarker({ event }: { event: OrbitEvent }) {
    const meta = EVENT_CATEGORY_META[event.category];
    return (
      <View style={styles.eventMarkerOuter} collapsable={false}>
        {event.image_url ? (
          <Image source={{ uri: event.image_url }} style={styles.eventMarkerImage} />
        ) : (
          <LinearGradient
            colors={meta.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.eventMarkerGrad}
          >
            <Ionicons name={meta.icon} size={20} color="#FFFFFF" />
          </LinearGradient>
        )}
      </View>
    );
  }

  const nearbyLabel = nearbyOthers.length >= 100 ? '100+ nearby' : `${nearbyOthers.length} orbiter${nearbyOthers.length !== 1 ? 's' : ''}`;
  const eventCardBottom = tabBarHeight + 16;

  const cardTranslateY = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [200, 0],
  });

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
          onPress={() => { if (selectedEvent) hideEventCard(); }}
          onMapReady={() => {
            mapReadyRef.current = true;
            if (userLocation) {
              mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 0);
            }
            scheduleIosMapKitCompassHide();
          }}
        >
          {userLocation && Platform.OS !== 'android' ? (
            <Circle center={userLocation} radius={radius} fillColor={radiusFill} strokeColor={radiusStroke} strokeWidth={1.5} />
          ) : null}

          {userLocation && nearbyOthers.map((u) => {
            const coord = markerCoordinate(u.id, userLocation.latitude, userLocation.longitude, u.distance || 100);
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

          {nearbyEvents.map((event) => (
            <Marker
              key={event.id}
              coordinate={eventMarkerCoordinate(event.id, event.latitude, event.longitude)}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={3}
              tracksViewChanges={Platform.OS === 'android'}
              onPress={() => showEventCard(event)}
            >
              <EventMarker event={event} />
            </Marker>
          ))}
        </MapView>
      </View>

      {/* Top chrome */}
      <View style={[styles.topChrome, { paddingTop: insets.top + 4 }]} pointerEvents="box-none">
        <View style={styles.topRow}>
          <View style={styles.topRowCluster}>
            <Pressable onPress={() => setSearchOpen(true)} style={({ pressed }) => [styles.mapControlBtn, pressed && { opacity: 0.88 }]}>
              <Ionicons name="search" size={22} color={colors.text.primary} />
            </Pressable>
            <Pressable onPress={() => setFilterOpen(true)} style={({ pressed }) => [styles.mapControlBtn, pressed && { opacity: 0.88 }]}>
              <Ionicons name="options" size={22} color={colors.text.primary} />
            </Pressable>
          </View>
          <View style={styles.topRowCluster}>
            <Pressable onPress={() => setNotifOpen(true)} style={({ pressed }) => [styles.mapControlBtn, pressed && { opacity: 0.88 }]}>
              <Ionicons name="notifications-outline" size={22} color={colors.text.primary} />
              {unreadNotifCount > 0 ? (
                <View style={styles.badgeDot}>
                  <AppText style={styles.badgeText}>{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</AppText>
                </View>
              ) : null}
            </Pressable>
            <Pressable onPress={() => router.push('/(tabs)/chat')} style={({ pressed }) => [styles.mapControlBtn, pressed && { opacity: 0.88 }]}>
              <Ionicons name="people-outline" size={22} color={colors.text.primary} />
            </Pressable>
          </View>
        </View>
        {nearbyOthers.length > 0 ? (
          <Pressable onPress={() => void refetchNearby()} style={({ pressed }) => [styles.nearbyPill, pressed && { opacity: 0.9 }]}>
            <View style={styles.nearbyDot} />
            <AppText style={styles.nearbyPillText}>{nearbyLabel}</AppText>
          </Pressable>
        ) : null}
        {locationError ? (
          <AppText style={{ marginTop: 8, fontSize: 11, color: colors.error, paddingHorizontal: 4, fontFamily: fonts.medium }}>
            {locationError}
          </AppText>
        ) : null}
      </View>

      {/* FAB cluster */}
      <View style={[styles.fabWrap, { bottom: eventCardBottom + 16 }]} pointerEvents="box-none">
        <Pressable
          onPress={() => setCreateEventOpen(true)}
          android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
          style={({ pressed }) => [styles.fabBtn, pressed && { opacity: 0.92 }, { marginBottom: 20 }]}
        >
          <LinearGradient colors={[colors.primary.default, colors.primary.dark]} start={{ x: 0.2, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.fabGrad} />
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>

        <Pressable
          onPress={centerOnUser}
          android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
          style={({ pressed }) => [styles.fabBtn, pressed && { opacity: 0.92 }]}
        >
          <LinearGradient colors={[colors.background.elevated, colors.background.secondary]} start={{ x: 0.2, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.fabGrad} />
          <Ionicons name="navigate" size={24} color={colors.primary.dark} style={{ transform: [{ rotate: '-42deg' }] }} />
        </Pressable>
      </View>

      {/* Event detail card */}
      {selectedEvent && (
        <>
          <Pressable style={styles.eventCardBackdrop} onPress={hideEventCard} />
          <Animated.View
            style={[
              styles.eventCard,
              { bottom: eventCardBottom, transform: [{ translateY: cardTranslateY }] },
            ]}
          >
            <View style={styles.eventCardHandle} />
            <View style={styles.eventCardHeader}>
              {/* Icon / image */}
              <View style={styles.eventCardIconWrap}>
                {selectedEvent.image_url ? (
                  <Image source={{ uri: selectedEvent.image_url }} style={styles.eventCardIconImage} />
                ) : (
                  <LinearGradient
                    colors={EVENT_CATEGORY_META[selectedEvent.category].gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.eventCardIconGrad}
                  >
                    <Ionicons name={EVENT_CATEGORY_META[selectedEvent.category].icon} size={22} color="#FFFFFF" />
                  </LinearGradient>
                )}
              </View>

              <View style={styles.eventCardInfo}>
                <AppText style={styles.eventCardTitle} numberOfLines={2}>{selectedEvent.title}</AppText>
                <AppText style={styles.eventCardMeta}>
                  {format(new Date(selectedEvent.start_at), 'EEE, MMM d · h:mm a')}
                </AppText>
                {selectedEvent.location_name ? (
                  <AppText style={styles.eventCardMeta} numberOfLines={1}>{selectedEvent.location_name}</AppText>
                ) : null}
                <View style={styles.eventCardCategoryBadge}>
                  <Ionicons name={EVENT_CATEGORY_META[selectedEvent.category].icon} size={10} color={colors.primary.dark} />
                  <AppText style={styles.eventCardCategoryText}>{EVENT_CATEGORY_META[selectedEvent.category].label}</AppText>
                </View>
              </View>

              <TouchableOpacity style={styles.eventCardClose} onPress={hideEventCard}>
                <Ionicons name="close" size={14} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {selectedEvent.is_own && (
              <View style={styles.eventCardActions}>
                <TouchableOpacity
                  style={styles.eventCardDeleteBtn}
                  onPress={() => handleDeleteEvent(selectedEvent)}
                  disabled={deleteEventMutation.isPending}
                >
                  <AppText style={styles.eventCardDeleteText}>
                    {deleteEventMutation.isPending ? 'Deleting…' : 'Delete Event'}
                  </AppText>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              style={[styles.modalBtn, { marginTop: 10 }]}
              onPress={() => router.push(`/event/${selectedEvent.id}`)}
            >
              <AppText style={styles.modalBtnText}>
                {selectedEvent.has_joined ? 'Open group' : 'View & join'}
              </AppText>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}

      <DiscoverNotificationsPanel visible={notifOpen} onClose={() => setNotifOpen(false)} />

      <CreateEventModal
        visible={createEventOpen}
        onClose={() => setCreateEventOpen(false)}
        onCreated={() => { setCreateEventOpen(false); void eventsQuery.refetch(); }}
        initialLat={userLocation?.latitude}
        initialLng={userLocation?.longitude}
      />

      <Modal visible={searchOpen} animationType="fade" transparent onRequestClose={() => setSearchOpen(false)}>
        <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.overlay }]} onPress={() => { Keyboard.dismiss(); setSearchOpen(false); }}>
          <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.lg }}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalCard}>
                <AppText style={styles.modalTitle}>Search</AppText>
                <AppText style={styles.modalBody}>Find people by name or interests — coming soon.</AppText>
                <TextInput style={styles.modalInput} placeholder="Search people…" placeholderTextColor={colors.text.tertiary} editable={false} />
                <Pressable style={styles.modalBtn} onPress={() => setSearchOpen(false)}>
                  <AppText style={styles.modalBtnText}>OK</AppText>
                </Pressable>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={filterOpen} animationType="fade" transparent onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.overlay }]} onPress={() => setFilterOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'center', padding: Spacing.lg }}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalCard}>
                <AppText style={styles.modalTitle}>Discovery radius</AppText>
                <AppText style={styles.modalBody}>Your map uses a {formatDistanceMeters(radius)} radius. Change it from your profile.</AppText>
                <Pressable style={styles.modalBtn} onPress={() => { setFilterOpen(false); router.push('/(tabs)/profile'); }}>
                  <AppText style={styles.modalBtnText}>Open profile</AppText>
                </Pressable>
                <Pressable style={[styles.modalBtn, { marginTop: 10, backgroundColor: colors.background.tertiary }]} onPress={() => setFilterOpen(false)}>
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
