/**
 * Discovery Tab - Main discovery feed with nearby users
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '../../constants/Colors';
import { UserCard, MatchModal, GradientButton } from '../../src/components';
import { useDiscoveryStore, useAuthStore, useChatStore } from '../../src/stores';
import { NearbyUser, Match } from '../../src/types';

export default function DiscoverScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<NearbyUser | null>(null);

  const { 
    isLoading, 
    error, 
    getNextUser, 
    likeUser, 
    passUser,
    currentRadius 
  } = useDiscoveryStore();
  const { updateLocation, user } = useAuthStore();
  const { startConversation } = useChatStore();

  useEffect(() => {
    requestLocationAndFetch();
  }, []);

  const requestLocationAndFetch = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Location Required',
          'MindLink needs your location to find people near you. Please enable location access in settings.',
          [{ text: 'OK' }]
        );
        setLocationLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      await updateLocation(location.coords.latitude, location.coords.longitude);
      const next = await getNextUser();
      setCurrentUser(next);
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get your location. Please try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await requestLocationAndFetch();
    setRefreshing(false);
  }, []);

  const handleLike = async (userId: string) => {
    const result = await likeUser(userId);
    if (result.isMatch && result.match) {
      setMatchedUser(result.match.matched_user);
      setShowMatchModal(true);
    }
    const next = await getNextUser();
    setCurrentUser(next);
  };

  const handlePass = async (userId: string) => {
    await passUser(userId);
    const next = await getNextUser();
    setCurrentUser(next);
  };

  const handleMessage = async () => {
    if (!matchedUser) return;
    
    try {
      const conversation = await startConversation(matchedUser.id);
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
        There are no people with matching interests within {currentRadius}m of you right now.
        {'\n'}Try expanding your radius or check back later!
      </Text>
      <GradientButton
        title="Refresh"
        onPress={onRefresh}
        style={styles.refreshButton}
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
        <Text style={styles.radiusText}>{currentRadius}m radius</Text>
      </View>
    </View>
  );

  if (locationLoading || (isLoading && !currentUser)) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={[Colors.background.primary, Colors.background.secondary]}
          style={StyleSheet.absoluteFillObject}
        />
        <ActivityIndicator size="large" color={Colors.primary.default} />
        <Text style={styles.loadingText}>Finding people near you...</Text>
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
