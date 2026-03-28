/**
 * Map Screen - Native Implementation
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { Avatar } from '../components';
import { useNearbyUsersQuery } from '../hooks/useOrbitApi';
import { useAuthStore } from '../stores';
import { NearbyUser } from '../types';

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<NearbyUser | null>(null);

  const { user, updateLocation } = useAuthStore();
  const radius = user?.discovery_radius ?? 10;
  const nearbyQuery = useNearbyUsersQuery(
    radius,
    user?.latitude,
    user?.longitude,
    !loading && user?.latitude != null && user?.longitude != null
  );
  const nearbyUsers = nearbyQuery.data?.users ?? [];

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

  const centerOnUser = () => {
    if (mapRef.current && userLocation) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary.default} />
      </View>
    );
  }

  const mapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  ];

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        customMapStyle={mapStyle}
        showsUserLocation={true}
        followsUserLocation={true}
        initialRegion={{
          latitude: userLocation?.latitude || 37.78825,
          longitude: userLocation?.longitude || -122.4324,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {userLocation && (
          <Circle
            center={userLocation}
            radius={radius * 1000}
            fillColor="rgba(139, 92, 246, 0.1)"
            strokeColor="rgba(139, 92, 246, 0.3)"
          />
        )}

        {nearbyUsers.map((u) => {
          const angle = Math.random() * 2 * Math.PI;
          const dist = (u.distance || 0.5) / 111;
          const lat = (userLocation?.latitude || 0) + dist * Math.cos(angle);
          const lng = (userLocation?.longitude || 0) + dist * Math.sin(angle);

          return (
            <Marker
              key={u.id}
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={() => setSelectedUser(u)}
            >
              <View style={styles.markerContainer}>
                <Avatar uri={u.avatar} name={u.username} size={32} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      <SafeAreaView style={styles.headerOverlay}>
        <View style={styles.header}>
          <Text style={styles.title}>Map</Text>
        </View>
      </SafeAreaView>

      <TouchableOpacity style={styles.centerButton} onPress={centerOnUser}>
        <Ionicons name="locate" size={24} color={Colors.primary.default} />
      </TouchableOpacity>

      {selectedUser && (
        <View style={styles.selectedCard}>
          <Avatar uri={selectedUser.avatar} name={selectedUser.username} size={40} />
          <View style={{ marginLeft: Spacing.md, flex: 1 }}>
            <Text style={styles.selectedName}>{selectedUser.username}</Text>
            <Text style={styles.selectedDistance}>{selectedUser.distance?.toFixed(1)} km</Text>
          </View>
          <TouchableOpacity onPress={() => setSelectedUser(null)}>
            <Ionicons name="close" size={24} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
      )}
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
  markerContainer: {
    padding: 2,
    backgroundColor: Colors.background.secondary,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.primary.default,
  },
  selectedCard: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: Colors.background.secondary,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 5,
  },
  selectedName: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectedDistance: {
    color: Colors.text.secondary,
    fontSize: 12,
  },
});
