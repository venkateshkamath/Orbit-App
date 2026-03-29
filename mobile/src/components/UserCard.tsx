/**
 * UserCard - Beautiful user profile card for discovery
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, FontSizes, FontWeights, Spacing } from '../../constants/Colors';
import { useOrbitTheme } from '../theme';
import { NearbyUser } from '../types';
import InterestTag from './InterestTag';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;

interface UserCardProps {
  user: NearbyUser;
  onLike: () => void;
  onPass: () => void;
  onPress: () => void;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  onLike,
  onPass,
  onPress,
}) => {
  const { colors, shadows } = useOrbitTheme();
  const likeScale = useSharedValue(1);
  const passScale = useSharedValue(1);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        cardContainer: {
          alignItems: 'center',
          marginBottom: Spacing.lg,
        },
        card: {
          width: CARD_WIDTH,
          backgroundColor: colors.background.card,
          borderRadius: BorderRadius.xl,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        imageContainer: {
          height: 320,
          position: 'relative',
        },
        image: {
          width: '100%',
          height: '100%',
          resizeMode: 'cover',
        },
        imagePlaceholder: {
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background.tertiary,
        },
        placeholderText: {
          fontSize: 80,
          fontWeight: FontWeights.bold,
          color: colors.text.primary,
        },
        hiddenPhotoLabel: {
          marginTop: Spacing.md,
          color: colors.text.secondary,
          fontSize: FontSizes.sm,
        },
        imageFade: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 100,
          backgroundColor: 'rgba(0,0,0,0.5)',
        },
        matchBadge: {
          position: 'absolute',
          top: Spacing.md,
          right: Spacing.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.xs,
          borderRadius: BorderRadius.sm,
          alignItems: 'center',
        },
        matchText: {
          color: '#FAFAFA',
          fontSize: FontSizes.lg,
          fontWeight: FontWeights.bold,
        },
        matchLabel: {
          color: '#FAFAFA',
          fontSize: FontSizes.xs,
          opacity: 0.9,
        },
        onlineBadge: {
          position: 'absolute',
          top: Spacing.md,
          left: Spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
          paddingHorizontal: Spacing.sm,
          paddingVertical: Spacing.xs,
          borderRadius: BorderRadius.full,
        },
        onlineDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.online,
          marginRight: Spacing.xs,
        },
        onlineText: {
          color: '#FAFAFA',
          fontSize: FontSizes.xs,
        },
        userInfoOverlay: {
          position: 'absolute',
          bottom: Spacing.md,
          left: Spacing.md,
          right: Spacing.md,
        },
        nameRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.xs,
        },
        username: {
          fontSize: FontSizes.xxl,
          fontWeight: FontWeights.bold,
          color: '#FAFAFA',
        },
        distanceRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: Spacing.xs,
        },
        distance: {
          color: 'rgba(255,255,255,0.88)',
          fontSize: FontSizes.sm,
          marginLeft: Spacing.xs,
        },
        bioContainer: {
          padding: Spacing.md,
          paddingBottom: 0,
        },
        bio: {
          color: colors.text.secondary,
          fontSize: FontSizes.sm,
          lineHeight: 20,
        },
        interestsContainer: {
          padding: Spacing.md,
          paddingTop: Spacing.sm,
        },
        interestsLabel: {
          color: colors.text.tertiary,
          fontSize: FontSizes.xs,
          marginBottom: Spacing.sm,
          textTransform: 'uppercase',
          letterSpacing: 1,
        },
        interestsList: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
        },
        moreInterests: {
          paddingVertical: Spacing.xs,
          paddingHorizontal: Spacing.sm,
          backgroundColor: colors.background.tertiary,
          borderRadius: BorderRadius.full,
        },
        moreText: {
          color: colors.text.tertiary,
          fontSize: FontSizes.xs,
        },
        actions: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          padding: Spacing.lg,
          paddingTop: Spacing.sm,
          gap: Spacing.xl,
        },
        actionButton: {
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadows.md,
        },
        passButton: {
          backgroundColor: colors.background.elevated,
          borderWidth: 2,
          borderColor: colors.error,
        },
        likeButton: {
          backgroundColor: colors.primary.default,
        },
      }),
    [colors, shadows]
  );

  const likeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const passAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: passScale.value }],
  }));

  const getDistanceText = (distance: number) => {
    if (distance < 1) return 'Right here!';
    if (distance < 10) return `${Math.round(distance)}m away`;
    if (distance < 1000) return `${Math.round(distance)}m away`;
    return `${(distance / 1000).toFixed(1)}km away`;
  };

  const getMatchColor = (score: number) => {
    if (score >= 80) return colors.success;
    if (score >= 50) return colors.warning;
    return colors.text.tertiary;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.95}
      style={styles.cardContainer}
    >
      <View style={styles.card}>
        {/* Profile Image - intentionally blurred/hidden to encourage meeting offline */}
        <View style={styles.imageContainer}>
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderText}>
              {user.username.charAt(0).toUpperCase()}
            </Text>
            <Text style={styles.hiddenPhotoLabel}>Photo unlocks on match</Text>
          </View>
          
          {/* Match Score Badge */}
          <View style={[styles.matchBadge, { backgroundColor: getMatchColor(user.match_score) }]}>
            <Text style={styles.matchText}>{user.match_score}</Text>
            <Text style={styles.matchLabel}>Orbit score</Text>
          </View>

          {/* Online Status */}
          {user.is_online && (
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online</Text>
            </View>
          )}

          <View style={styles.imageFade} />

          {/* User Info Overlay */}
          <View style={styles.userInfoOverlay}>
            <View style={styles.nameRow}>
              <Text style={styles.username}>{user.username}</Text>
              {user.is_verified && (
                <Ionicons name="checkmark-circle" size={20} color={colors.info} />
              )}
            </View>
            <View style={styles.distanceRow}>
              <Ionicons name="location" size={14} color={colors.primary.default} />
              <Text style={styles.distance}>{getDistanceText(user.distance)}</Text>
            </View>
          </View>
        </View>

        {/* Bio */}
        {user.bio && (
          <View style={styles.bioContainer}>
            <Text style={styles.bio} numberOfLines={2}>
              {user.bio}
            </Text>
          </View>
        )}

        {/* Interests */}
        <View style={styles.interestsContainer}>
          <Text style={styles.interestsLabel}>Common Interests</Text>
          <View style={styles.interestsList}>
            {user.interests.slice(0, 4).map((interest) => (
              <InterestTag
                key={interest.id}
                interest={interest}
                selected={user.common_interests.includes(interest.id)}
                size="sm"
              />
            ))}
            {user.interests.length > 4 && (
              <View style={styles.moreInterests}>
                <Text style={styles.moreText}>+{user.interests.length - 4}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Animated.View style={passAnimatedStyle}>
            <TouchableOpacity
              onPress={onPass}
              onPressIn={() => (passScale.value = withSpring(0.9))}
              onPressOut={() => (passScale.value = withSpring(1))}
              style={[styles.actionButton, styles.passButton]}
            >
              <Ionicons name="close" size={32} color={colors.error} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={likeAnimatedStyle}>
            <TouchableOpacity
              onPress={onLike}
              onPressIn={() => (likeScale.value = withSpring(0.9))}
              onPressOut={() => (likeScale.value = withSpring(1))}
              style={[styles.actionButton, styles.likeButton]}
            >
              <Ionicons name="heart" size={28} color="#FAFAFA" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default UserCard;
