/**
 * Map Screen - Web Implementation
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { UserCard } from '../components';
import { useLikeUserMutation, useNearbyUsersQuery, usePassUserMutation } from '../hooks/useOrbitApi';
import { useAuthStore } from '../stores';

export default function MapScreen() {
  const { user, updateLocation } = useAuthStore();
  const radius = user?.discovery_radius ?? 10;
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary.default} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.title}>Map</Text>
        </View>

        <View style={styles.webNotice}>
          <Text style={styles.webNoticeText}>
            Interactive map is available on iOS and Android.
          </Text>
        </View>

        <FlatList
          data={nearbyUsers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <UserCard
              user={item}
              onLike={() => likeMut.mutate(item.id)}
              onPass={() => passMut.mutate(item.id)}
              onPress={() => {}}
            />
          )}
          contentContainerStyle={{ padding: Spacing.lg }}
        />
      </SafeAreaView>
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
  safeArea: {
    flex: 1,
  },
  header: {
    padding: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  webNotice: {
    padding: Spacing.md,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  webNoticeText: {
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
