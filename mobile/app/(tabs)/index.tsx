/**
 * Discovery Tab - Main discovery feed with nearby users
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { UserCard, MatchModal, GradientButton } from '../../src/components';
import {
  useDiscoverNextQuery,
  useLikeUserMutation,
  usePassUserMutation,
  useStartConversationMutation,
} from '../../src/hooks/useOrbitApi';
import { useLocationContext } from '../../src/context/LocationContext';
import { useAuthStore } from '../../src/stores';
import { NearbyUser } from '../../src/types';

export default function DiscoverScreen() {
  const [locationRefreshing, setLocationRefreshing] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState<any>(null);

  const { permissionDenied } = useLocationContext();
  const { updateLocation, user } = useAuthStore();
  const radius = user?.discovery_radius ?? 10;
  const discover = useDiscoverNextQuery(radius, user?.latitude, user?.longitude);
  const likeMut = useLikeUserMutation();
  const passMut = usePassUserMutation();
  const startConversationMut = useStartConversationMutation();

  const currentUser = discover.data?.user ?? null;
  const isLoadingDiscover =
    discover.isPending && discover.fetchStatus !== 'idle';

  const refreshLocationNow = async () => {
    setLocationRefreshing(true);
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Required',
          'Allow location in the bar above, or enable it in system settings.',
          [{ text: 'OK' }]
        );
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      await updateLocation(location.coords.latitude, location.coords.longitude);
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get your location. Please try again.');
    } finally {
      setLocationRefreshing(false);
    }
  };

  const onRefresh = async () => {
    await refreshLocationNow();
  };

  const handleLike = async (userId: string) => {
    try {
      const result = await likeMut.mutateAsync(userId);
      if (result.is_match && result.match) {
        setMatchedUser(result.match.matched_user);
        setShowMatchModal(true);
      }
    } catch {
      Alert.alert('Error', 'Could not send like');
    }
  };

  const handlePass = async (userId: string) => {
    try {
      await passMut.mutateAsync(userId);
    } catch {
      Alert.alert('Error', 'Could not pass');
    }
  };

  const handleMessage = async () => {
    if (!matchedUser) return;
    
    try {
      const conversation = await startConversationMut.mutateAsync({
        userId: matchedUser.id,
      });
      setShowMatchModal(false);
      router.push(`/chat/${conversation.id}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to start conversation');
    }
  };

  const handleUserPress = (user: NearbyUser) => {
    // Navigate to user profile detail
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="location" size={48} color={Colors.primary.default} />
      </View>
      <Text style={styles.emptyTitle}>No one nearby yet</Text>
      <Text style={styles.emptySubtitle}>
        There are no people with matching interests within {radius}m of you right now.
        {'\n'}Try expanding your radius or check back later!
      </Text>
      <GradientButton
        title={locationRefreshing ? 'Updating…' : 'Refresh location'}
        onPress={onRefresh}
        style={styles.refreshButton}
        loading={locationRefreshing}
      />
    </View>
  );

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <Text style={styles.nearbyCount}>
        {currentUser ? 'We found someone nearby' : 'No one nearby for now'}
      </Text>
      <View style={styles.radiusBadge}>
        <Ionicons name="radio-outline" size={14} color={Colors.primary.default} />
        <Text style={styles.radiusText}>{radius}m radius</Text>
      </View>
    </View>
  );

  const noCoords = user?.latitude == null || user?.longitude == null;

  if (permissionDenied && noCoords) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.background.primary, Colors.background.secondary]}
          style={StyleSheet.absoluteFillObject}
        />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.title}>Discover</Text>
            <Text style={styles.subtitle}>People with similar interests near you</Text>
          </View>
          <View style={styles.emptyContainer}>
            <Ionicons name="location-outline" size={56} color={Colors.text.tertiary} />
            <Text style={styles.emptyTitle}>Location is off</Text>
            <Text style={styles.emptySubtitle}>
              Allow location at the top of the screen so we can find people near you.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (
    noCoords ||
    (user?.latitude != null && isLoadingDiscover && !discover.data && !discover.error)
  ) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={[Colors.background.primary, Colors.background.secondary]}
          style={StyleSheet.absoluteFillObject}
        />
        <ActivityIndicator size="large" color={Colors.primary.default} />
        <Text style={styles.loadingText}>
          {noCoords ? 'Locking in your precise location…' : 'Finding people near you…'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.background.primary, Colors.background.secondary]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Discover</Text>
          <Text style={styles.subtitle}>
            People with similar interests near you
          </Text>
        </View>

        {currentUser ? (
          <View style={styles.listContent}>
            {renderHeader()}
            <UserCard
              user={currentUser}
              onLike={() => handleLike(currentUser.id)}
              onPass={() => handlePass(currentUser.id)}
              onPress={() => handleUserPress(currentUser)}
            />
          </View>
        ) : (
          renderEmptyState()
        )}
      </SafeAreaView>

      {/* Match Modal */}
      <MatchModal
        visible={showMatchModal}
        user={matchedUser}
        onClose={() => setShowMatchModal(false)}
        onMessage={handleMessage}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.text.secondary,
    fontSize: FontSizes.md,
    marginTop: Spacing.md,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xxxl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  nearbyCount: {
    fontSize: FontSizes.sm,
    color: Colors.text.secondary,
    fontWeight: FontWeights.medium,
  },
  radiusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary.default + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  radiusText: {
    fontSize: FontSizes.xs,
    color: Colors.primary.default,
    marginLeft: Spacing.xs,
    fontWeight: FontWeights.medium,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary.default + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  refreshButton: {
    paddingHorizontal: Spacing.xl,
  },
});
